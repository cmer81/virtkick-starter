#!/usr/bin/env node

var path = require('path');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var fs = require('fs');
var yargs = require('yargs');
var async = require('async');
var extend = require('extend');

psTree = require('ps-tree')

var exittingApp = false;

process.setMaxListeners(100);

var argv = yargs
.alias('h', 'help')
.describe('h', 'show help')
.alias('d', 'development')
.describe('d', 'run in development mode')
.alias('m', 'migrate-db')
.describe('m', 'migrate database before running')
.alias('a', 'prepare-assets')
.describe('a', 'prepare assets before running (goes with production run)')
.alias('p', 'production')
.describe('p', 'run in production mode (add also -d to have production debug)')
.alias('r', 'livereload')
.describe('r', 'run development mode with livereload system')
.argv;

if(argv.h) {
  return yargs.showHelp();
}

if(!argv.d && !argv.p) {
  return yargs.showHelp();
}

var env = process.env;

if(argv.p) {
  env.RAILS_ENV = 'production';
  if(argv.d) {
    env.PRODUCTION_DEBUG = '1';
  }
  env.SECRET_KEY_BASE = 'x';
  env.DEVISE_SECRET_KEY = 'x';
} else if(argv.d) {
  env.RAILS_ENV = 'development';
}


var BASE_DIR = env.BASE_DIR || __dirname;

env.PORT = env.PORT || 3000;
env.RAILS_PORT = env.RAILS_PORT || 60000;
env.RAILS_HOST = "localhost";

env.HDD_DIR = env.HDD_DIR || path.join(BASE_DIR, 'hdd');
env.ISO_DIR = env.ISO_DIR || path.join(BASE_DIR, 'iso');

var workingScriptCommand = false;

function sha512(file, cb) {
  var stream = fs.createReadStream(file);
  var algo = 'sha512';
  var shasum = crypto.createHash(algo);
  stream.on('data', function(data) {
    shasum.update(data);
  });
  stream.on('error', cb);
  stream.on('end', function() {
    cb(null, shasum.digest('hash'))
  });
}

function checkScript(cb) {
  var output = child_process.spawn('script', ['--help']);
  var allData = "";
  output.stdout.on('data', function(data) {
    allData += data.toString('utf8');
  });
  output.stderr.on('data', function(data) {
    allData += data.toString('utf8');
  });
  output.once('exit', function() {
    setTimeout(function() {
      allData.split(/\n/).forEach(function(line) {
        if(line.match(/-e/) && line.match(/--return/))
          workingScriptCommand = true;
      });;
      cb();
    }, 0);
  });
  output.once('error', function() {
    cb();
  });
}

function spawn(cwd, command, options) {
  chSpawn = child_process.spawn;

  var proc;

  if(workingScriptCommand) {
    proc =
      chSpawn('script', ['/dev/null', '-e', '-q', '-c', command], extend({}, {
      env: env,
      cwd: cwd,
      detached: true
    }, options));
  } else {
    proc = chSpawn('bash', ['-c', command], extend({}, {
      env: env,
      cwd: cwd,
      detached: true
    }, options));
  }

  var exitCounter = 0;
  var exitHandler = function() {
    exittingApp = true;
    exitCounter++;
    psTree(proc.pid, function(err, children) {
      var killer = chSpawn('kill', ['-9'].concat(children.map(function(p) {
        return p.PID;
      })));
      killer.on('exit', function() {
        exitCounter--;
        if(exitCounter == 0) {
          process.emit('removeExitHandlers');
          process.exit();
        }
      });
    });
  };
  proc.once('exit', function() {
    process.removeListener('exit', exitHandler);
  });
  process.once('exit', exitHandler);
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(function(signal) {
    process.once(signal, function() {
      exitHandler();
    });
  });
  proc.restart = function() {
    psTree(proc.pid, function(err, children) {
      var killer = chSpawn('kill', ['-9'].concat(children.map(function(p) {
        return p.PID;
      })));
    });
  };
  return proc;
}

function spawnAsVirtkick(cmd) {
  return spawn("./", "ssh -t -t -p " + (process.env.SSH_PORT || 22) +  " -o \"StrictHostKeyChecking no\" virtkick@localhost " + cmd);
}

function runAsVirtkick(cmd, cb) {
  var proc = spawnAsVirtkick(cmd);
  var output = "";
  proc.stdout.on('data', function(data) {
    output += data.toString('utf8');
  });
  proc.stderr.on('data', function(data) {
    output += data.toString('utf8');
  });
  proc.on('exit', function(code) {
    cb(code, output);
  });

}

function forceExit() {
  process.emit('exit');
}

require('virtkick-proxy');

var child_process = require('child_process');
var watch = require('node-watch');
var split = require('split');

var webappDir = env.WEBAPP_DIR || path.join(BASE_DIR, 'webapp');
var backendDir = env.BACKEND_DIR || path.join(BASE_DIR, 'backend');


console.log("RAILS_ENV=" + env.RAILS_ENV);
console.log("webapp location:", webappDir);
console.log("backend location:", backendDir);

function bindOutput(proc, label, exitCb) {
  var noLabels = false;
  var lines = [];
  proc.stdout.pipe(split()).on('data', function(line) {
    if(line == '^^== BEGIN EXCEPTION') {
      console.log('['+label+'] Unhandled exception ');
      noLabels = true;
      lines = [];
      return;
    } else if(line == '__== END EXCEPTION') {
      noLabels = false;

      try {
        var xclip = child_process.execFile('xclip', ['-selection', 'c']);
        xclip.stdin.write(lines.join('\n') + '\n');
        xclip.stdin.end();
        xclip.on('error', function(err) {
          console.error('xclip failed, unable to copy exception to clipboard');
        });
      } catch(err) {

      }
      return;
    } else if(noLabels) {
      lines.push(line);
    }


    if(line.length)
      process.stdout.write( (noLabels ? '' : '['+label+'] ') + line + '\n')
  });
  proc.stderr.pipe(split()).on('data', function(line) { if(line.length) process.stderr.write(line + '\n') });
  proc.once('error', forceExit);
  function exitHandler(code) {
    console.log("Process", label, "exit:", code);
    if(exittingApp)
      return;
    exitCb(code);
  }

  if(exitCb) {
    proc.once('exit', exitHandler);
    process.once('removeExitHandlers', function() {
      proc.removeListener('exit', exitHandler);
    });
  }
}

var filter = function(pattern, fn) {
  return function(filename) {
    if (pattern.test(filename)) {
      fn(filename);
    }
  }
}

function runEverything() {
  if(argv.r) {
    process.env.LIVERELOAD = 1;
  }

  var railsProcess;
  var workerProcess = [];
  function spawnRails() {
    var rails = spawn(webappDir, 'bundle exec puma -C config/puma.rb -p ' + env.RAILS_PORT + '');
    console.log("RAILS PID", rails.pid);
    bindOutput(rails, 'rails', function() {
      console.log('Process exitted, restarting');
      railsProcess = spawnRails();
    });
    return rails;
  }
  railsProcess = spawnRails();

  function createWorker(workerN) {
    var worker = spawn(webappDir, 'bundle exec rake jobs:work');
    bindOutput(worker, 'work' + workerN, function() {
      console.log('Process exitted, restarting');
      workerProcess[workerN-1] = createWorker(workerN);
    });
    return worker;
  }

  var workerCount = env.WORKER_COUNT || 1;
  workerCount = Math.min(require('os').cpus().length, Math.max(workerCount, 1));

  for(var i = 0;i < workerCount;++i) {
    workerProcess[i] = createWorker(i+1);
  }

  watch(webappDir, {followSymLinks: true}, filter(/\.rb$/, function(f) {
    railsProcess.restart();
    for(var i = 0;i < workerCount;++i) {
      workerProcess[i].restart();
    }
  }));

  var backend;
  function spawnBackend() {
    backend = spawn(backendDir, 'python2 ./manage.py runserver');
    bindOutput(backend, 'virtm', function() {
      backend = spawnBackend();
    });
    return backend;
  }

  backend = spawnBackend();
  watch(backendDir, filter(/\.py$/, function(f) {
    backend.restart();
  }));

  
  if(argv.r) {
    var guard = spawn(webappDir, 'guard -P livereload');
    bindOutput(guard, 'guard', function() {
      console.log('Guard exited');
    });
  }

}

var tasks1 = [];
var tasks2 = [];
var tasks3 = [];

var serialTasks = [[checkScript], tasks1, tasks2, tasks3];


if(argv.i) {
  tasks1.push(function(cb) {
    var proc = spawn(webappDir, '(bundle check || bundle install --jobs 8)');
    bindOutput(proc, 'install', cb);
  });

  tasks1.push(function(cb) {
    async.series([
      function(cb) {
        var proc = spawn(backendDir, 'python2 ./manage.py syncdb --noinput');
        bindOutput(proc, 'backend:syncdb', cb);
      },
      function(cb) {
        var proc = spawn(backendDir, 'python2 ./manage.py collectstatic --noinput');
        bindOutput(proc, 'backend:collectstatic', cb);
      }
    ], cb);
  });


} else if(argv.u) {
  tasks1.push(function(cb) {
    var proc = spawn(webappDir, 'bundle update');
    bindOutput(proc, 'update', cb);
  });
}


if(argv.m) {
  tasks2.push(function(cb) {
    var proc = spawn(webappDir, 'bundle exec rake db:migrate');
    bindOutput(proc, 'proc', cb);
  });
  tasks2.push(function(cb) {
    var proc = spawn(webappDir, 'bundle exec rake db:migrate RAILS_ENV=test');
    bindOutput(proc, 'proc', cb);
  });
}

if(argv.c) {
  tasks3.push(function(cb) {
    var proc = spawn(webappDir, 'bundle exec rake assets:clean');
    bindOutput(proc, 'assets:clean', cb);
  });
}


if(argv.a) {
  tasks3.push(function(cb) {
    var proc = spawn(webappDir, 'bundle exec rake assets:precompile');
    bindOutput(proc, 'assets', cb);
  });
}

async.eachSeries(serialTasks, function(tasks, cb) {
  async.parallel(tasks, cb);
}, function(err) {
  if(err) {
    return console.log("One of required tasks has failed")
  }
  runEverything();
  if(!process.env.NO_DOWNLOAD) {
    downloadIsos();
  }
});

function downloadIsos() {
  if(fs.existsSync(path.join(__dirname, ".isos-done"))) {
    console.log("All isos are downloaded, delete .isos-done to redo")
    return;
  }
  console.log("Starting download of ISO files")

  var isos = yaml.safeLoad(fs.readFileSync(path.join(__dirname, './webapp/app/models/plans/iso_images.yml')), {});

  async.eachLimit(isos, 4, function(iso, cb) {
    if(!iso.mirrors) {
      console.log("Iso", iso.name, "does not have mirrors");
      return cb();
    }

    console.log('[aria2c:' +iso.long_name+'] Starting download of iso: '+ iso.file);
    var aria2c = spawnAsVirtkick("aria2c -V --seed-time=0 --save-session-interval=5 --allow-overwrite=true --follow-metalink=mem -q -c -d iso " + iso.mirrors.map(function(url) {return "'" + url + "'";}).join(" "));
    bindOutput(aria2c, 'aria2c:' +iso.long_name, function(code) {
      if(code) { 
        return cb(code);
      }

      if(iso.sha512) {
        runAsVirtkick('sha512sum "iso/' + iso.file + '"', function(code, output) {
          var m = output.match(/^([0-9a-f]+)/);
          if(m && m[1] === iso.sha512) {
            return cb(code);
          }
          cb(code || new Error('sha512 of "iso/'+iso.file+'" does not match: expecting("'+iso.sha512+'") got("'+(m?(m[1]):null)+'") - output: ' + output));
        });
      } else {
        return cb(code);
      }

    });

  }, function(err) {
    if(err) {
      console.log("Not all isos could have been downloaded, will retry on next start", err);
      return;
    }
    console.log("All isos downloaded");
    fs.writeFileSync(path.join(__dirname, ".isos-done"), "DONE");
  });
  


}
