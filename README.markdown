chainsaw
========

Build chainable fluent interfaces the easy way in node.js.

[![build status](https://secure.travis-ci.org/substack/node-chainsaw.png)](http://travis-ci.org/substack/node-chainsaw)

With this meta-module you can write modules with chainable interfaces.
Chainsaw takes care of all of the boring details and makes nested flow control
super simple too.

Just call `chainsaw` with a constructor function like in the examples below.
In your methods, just do `saw.next()` to move along to the next event and
`saw.nest()` to create a nested chain.

![chainsaw](http://substack.net/images/chainsaw.png)

Examples
========

add_do.js
---------

This silly example adds values with a chainsaw.

    var chainsaw = require('chainsaw');
    
    function AddDo (sum) {
        return chainsaw(function (saw) {
            this.add = function (n) {
                sum += n;
                saw.next();
            };
             
            this.do = function (cb) {
                saw.nest(cb, sum);
            };
        });
    }
    
    AddDo(0)
        .add(5)
        .add(10)
        .do(function (sum) {
            if (sum > 12) this.add(-10);
        })
        .do(function (sum) {
            console.log('Sum: ' + sum);
        })
    ;

Output:
    Sum: 5

prompt.js
---------

This example provides a wrapper on top of stdin with the help of
[node-lazy](https://github.com/pkrumins/node-lazy) for line-processing.

    var chainsaw = require('chainsaw');
    var lazy = require('lazy');
    
    module.exports = Prompt;
    function Prompt (stream) {
        var waiting = [];
        var lines = [];
        var lazy = lazy(stream).lines.map(String)
            .forEach(function (line) {
                if (waiting.length) {
                    var w = waiting.shift();
                    w(line);
                }
                else lines.push(line);
            })
        ;
        
        var vars = {};
        return chainsaw(function (saw) {
            this.getline = function (f) {
                var g = function (line) {
                    saw.nest(f, line, vars);
                };
                
                if (lines.length) g(lines.shift());
                else waiting.push(g);
            };
            
            this.do = function (cb) {
                saw.nest(cb, vars);
            };
        });
    }

And now for the new Prompt() module in action:

    var util = require('util');
    var stdin = process.openStdin();
     
    Prompt(stdin)
        .do(function () {
            util.print('x = ');
        })
        .getline(function (line, vars) {
            vars.x = parseInt(line, 10);
        })
        .do(function () {
            util.print('y = ');
        })
        .getline(function (line, vars) {
            vars.y = parseInt(line, 10);
        })
        .do(function (vars) {
            if (vars.x + vars.y < 10) {
                util.print('z = ');
                this.getline(function (line) {
                    vars.z = parseInt(line, 10);
                })
            }
            else {
                vars.z = 0;
            }
        })
        .do(function (vars) {
            console.log('x + y + z = ' + (vars.x + vars.y + vars.z));
            process.exit();
        })
    ;

Installation
============

With [npm](http://github.com/isaacs/npm) do:

```
npm install chainsaw
```

Light Mode vs Full Mode
=======================

`node-chainsaw` supports two different modes. In full mode, every
action is recorded, which allows you to replay actions using the
`jump()`, `trap()` and `down()` methods.

However, if your chainsaws are long-lived, recording every action can
consume a tremendous amount of memory, so we also offer a "light" mode
where actions are not recorded and the aforementioned methods are
disabled.

To enable light mode simply use `chainsaw.light()` to construct your
saw, instead of `chainsaw()`.

Running tests
============

To run the tests with [expresso](http://github.com/visionmedia/expresso),
just do:

    expresso
