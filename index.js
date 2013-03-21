var traverse = require('traverse');
var EventEmitter = require('events').EventEmitter;

module.exports = chainsaw;

// Factory function that returns a chained object (with recording).
// Requires builder function.
function chainsaw (builder) {

    // Returns a new EventImmitter object with a few added methods like `pop`,
    // `next`,  `chain`, `nest`, and `handlers` which is an empty object
    // placeholder.
    var saw = chainsaw.saw(builder, {});

    // Passed in builder function is executed in the context of our
    // `saw.handlers` object so that we can attach our own methods.
    var r = builder.call(saw.handlers, saw);

    // Executed builder function doesn't usually return anything but
    // if it does, we set that response as `saw.handlers` instead.
    if (r !== undefined) saw.handlers = r;

    // Start recording actions, use `chainsaw.light` if you don't want to
    // record steps for optional playback in the future.
    saw.record();

    return saw.chain();
};

// Same as `chainsaw`, just does not record.
chainsaw.light = function chainsawLight (builder) {
    var saw = chainsaw.saw(builder, {});
    var r = builder.call(saw.handlers, saw);
    if (r !== undefined) saw.handlers = r;
    return saw.chain();
};

// Setup method that takes builder function returns EventImitter object.
chainsaw.saw = function (builder, handlers) {
    var saw = new EventEmitter;
    saw.handlers = handlers;

    // Actions array that identifies in what order handler's are executed and
    // the arguments passed to them for later execution.
    saw.actions = [];

    // Data looks like this:
    // saw.actions = [{
    //    path: ['methodName1', methodName2],
    //    args: [arguments]
    //}, ...];

    // Return a copy of `saw.handlers`, modified so original function calls
    // actually add item to the `action` array queue. Then trigger `saw.next`
    // to start.
    saw.chain = function () {
        var ch = traverse(saw.handlers).map(function (node) {
            if (this.isRoot) return node;
            // Path is method name.
            var ps = this.path;

            if (typeof node === 'function') {
                this.update(function () {
                    saw.actions.push({
                        // Method name.
                        path : ps,
                        // Arguments passed.
                        args : [].slice.call(arguments)
                    });
                    return ch;
                });
            }
        });

        process.nextTick(function () {
            saw.emit('begin');
            saw.next();
        });

        return ch;
    };


    // Remove and return the next item in the actions array.
    // Called by `saw.next`.
    saw.pop = function () {
        return saw.actions.shift();
    };

    saw.next = function () {
        // Remove and return the next item in the actions array.
        var action = saw.pop();

        // If action is `undefined` emit end event.
        if (!action) {
            saw.emit('end');
        }
        else if (!action.trap) {
            var node = saw.handlers;
            action.path.forEach(function (key) { node = node[key] });
            node.apply(saw.handlers, action.args);
        }
    };


    // Return a nested chain within the current chain.
    // First agument can optionally be a boolean which decides whether to
    // automatically advanced to the next queued action (true by default).
    saw.nest = function (cb) {
        var args = [].slice.call(arguments, 1);
        var autonext = true;

        if (typeof cb === 'boolean') {
            var autonext = cb;
            cb = args.shift();
        }

        // Returns a new EventImmitter object with a few added methods like `pop`,
        // `next`,  `chain`, and `nest`.
        var s = chainsaw.saw(builder, {});

        // Passed in builder function is executed in the context of our `saw`
        // object so that we have the ability to add to `saw`'s handers.
        var r = builder.call(s.handlers, s);

        // Executed passed in builder function doesn't usually return anything but
        // if it does, we set that response as `saw.handlers` instead.
        if (r !== undefined) s.handlers = r;

        // If we are recording...
        if ("undefined" !== typeof saw.step) {
            // ... our children should, too
            s.record();
        }

        cb.apply(s.chain(), args);
        if (autonext !== false) s.on('end', saw.next);
    };

    // Start recording actions.
    saw.record = function () {
        upgradeChainsaw(saw);
    };

    ['trap', 'down', 'jump'].forEach(function (method) {
        saw[method] = function () {
            throw new Error("To use the trap, down and jump features, please "+
                            "call record() first to start recording actions.");
        };
    });

    return saw;
};

function upgradeChainsaw(saw) {
    saw.step = 0;

    // override pop
    saw.pop = function () {
        return saw.actions[saw.step++];
    };

    saw.trap = function (name, cb) {
        var ps = Array.isArray(name) ? name : [name];
        saw.actions.push({
            path : ps,
            step : saw.step,
            cb : cb,
            trap : true
        });
    };

    saw.down = function (name) {
        var ps = (Array.isArray(name) ? name : [name]).join('/');
        var i = saw.actions.slice(saw.step).map(function (x) {
            if (x.trap && x.step <= saw.step) return false;
            return x.path.join('/') == ps;
        }).indexOf(true);

        if (i >= 0) saw.step += i;
        else saw.step = saw.actions.length;

        var act = saw.actions[saw.step - 1];
        if (act && act.trap) {
            // It's a trap!
            saw.step = act.step;
            act.cb();
        }
        else saw.next();
    };

    saw.jump = function (step) {
        saw.step = step;
        saw.next();
    };
};
