/*
 * grunt-vagrant
 * https://github.com/ramiel/grunt-vagrant
 *
 * Copyright (c) 2014 Fabrizio Ruggeri
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var child_process = require('child_process'),
      exec = child_process.exec,
      spawn = child_process.spawn,
      path = require('path'),
      util = require('util'),
      step = require('step');

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('vagrant', 'Grunt plugin to control your Vagrant environments', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        vagrantfile: '.',
        vagrant : 'vagrant',
        plugins : []
    });
    
    if(!this.data.commands || this.data.commands.length === 0){
        grunt.log.warn('Provide one command at least');
        return false;
    }

    var dir_cwd = path.dirname(options.vagrantfile),
        execution_plan = [],
        on_close_func = function(context, cmd){
            return function (code) {
                if(code !== 0){
                  return context(new Error(util.format('Process %s exited with status %s', cmd, code)));
                }
                context(null);
            }
        },
        define_func = function(cmd, args){
          return function( error ){
              if(error){ throw error;}
              var execution = spawn(cmd, args,  {cwd: dir_cwd});
              execution.on('close', on_close_func(this, cmd + ' ' + args.join(' ') ));
              execution.stdout.on('data',grunt.verbose.write);
              execution.stderr.on('data',grunt.log.error);
              
          };
        },
        plugin_func = function(plugin_name, cb){
            var cmd = util.format('%s plugin install %s', options.vagrant, plugin_name );
            grunt.log.writeln(util.format('Installing missing vagrant plugin: "%s"',plugin_name));
            exec(cmd, { env: process.env }, cb);
        },
        plugin_list_func = function(plugins){
            return function(){
                var finish_cb = this;
                step(
                  function(){
                      var cmd = util.format('%s plugin list',options.vagrant);
                      exec(cmd, { env: process.env }, this);
                  },
                  function(error, stdout, sterr){
                      var installed = stdout.split('\n');
                      installed = installed.map(function(line){
                          line = line.split(' ');
                          return line[0];
                      });
                      plugins = plugins.filter(function(p){
                          return installed.indexOf(p) == -1;
                      });
                      var group = this.group();
                      for(var i = 0, len = plugins.length; i< len; i++){
                          plugin_func(plugins[i], group());
                      }
                  },
                  finish_cb
                );
            }
        },
        done = this.async();

    if(options.plugins.length > 0){
        execution_plan.push(plugin_list_func(options.plugins));
    }
    
    for(var i=0, len = this.data.commands.length; i < len; i++){
        execution_plan.push(define_func(options.vagrant, this.data.commands[i] ));
    }
    execution_plan.push(function(error, stdout, stderr){
        if(error){ grunt.log.error(error); return false;}
        grunt.log.writeln('Vagrant environment ready');
        done();
    });

    step.apply(step, execution_plan);
  });

};
