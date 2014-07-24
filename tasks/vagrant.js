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
        define_func = function(cmd){
          return function( error, stdout, stderr){
              if(error){ throw error;}
              if(stdout || stderr){
                  grunt.verbose.write(stdout);
                  grunt.verbose.error(stderr);
              }
              exec(cmd, {cwd: dir_cwd}, this);
          };
        },
        plugin_func = function(plugin_name, cb){
            var cmd = util.format('%s plugin install %s', options.vagrant, plugin_name );
            exec(cmd, cb);
        },
        plugin_list_func = function(plugins){
            return function(){
                var done = this;
                step(
                  function(){
                      var cmd = util.format('%s plugin list',options.vagrant);
                      exec(cmd, this);
                  },
                  function(error, stdout, sterr){
                      var installed = stdout.split('\n');
                      installed.map(function(line){
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
                  done
                );
            }
        },
        done = this.async();

    if(options.plugins.length > 0){
        execution_plan.push(plugin_list_func(options.plugins));
    }
    
    for(var i=0, len = this.data.commands.length; i < len; i++){
        var cmd = util.format('%s %s', options.vagrant, this.data.commands[i].join(' ') );
        execution_plan.push(define_func(cmd));
    }
    execution_plan.push(function(error, stdout, stderr){
        if(error){ grunt.log.error(error); return false;}
        if(stdout || stderr){
            grunt.verbose.write(stdout);
            grunt.verbose.error(stderr);  
        }
        grunt.log.writeln('Vagrant environment ready');
        done();
    });

    step.apply(step, execution_plan);
  });

};
