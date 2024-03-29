'use strict';
let path = require('path');
let inherits = require('util').inherits;
let apis = require('apis');
let handlers = apis.handlers;
let contract = handlers.cont;
let httpOnly = handlers.httpOnly;
let resource = apis.resources.res;
let addResource = apis.resources.helpers.add;

let renderToResponse = require('./helpers').renderToResponse;

let middlewarePath = path.join(process.cwd(), 'lib', 'middlewares');
let apiRx = /^resources\..*(\.api)$/;

let Contract = function() {
  handlers.Contract.call(this);
  this.middlewares = [];
};
inherits(Contract, handlers.Contract);

Contract.prototype.unitInit = function(units) {
  this.units = units;

  if (this.isMain) {
    let settings = units.require('core.settings');
    this.addApi('/api/' + (settings.apiVersion || 1));

    if (settings.core.debug) {
      this.add(contract('/test', [ apis.testPage.contract ]));
      this.add(resource.subpaths(settings.staticUrl || '/static', handlers.st(settings.staticPath)));
    }
  }
};

Contract.prototype.addApi = function(base) {
  let units = this.units;
  let loadedUnits = units.unitInfoDict;
  let auth = {
    handler: units.require('auth').handler
  };

  for (let i in loadedUnits) {
    if (apiRx.test(i)) {
      addResource(this, auth, {
        base: base,
        api: units.get(i),
        request: units.get(i.replace('.api', '.request')),
        response: units.get(i.replace('.api', '.response'))
      });
    }
  }
};

Contract.prototype.addViews = function(views) {
  let units = this.units;
  let auth = units.require('auth').handler;

  for (let url in views) {
    let view = units.require(views[url]);
    this.add( resource(
      new RegExp(url),
      {
        get: [
          httpOnly(),
          auth().unprotected.opt,
          this.getViewImplementation(view)
        ]
      }
    ));
  }
};

Contract.prototype.getViewImplementation = function(view) {
  let units = this.units;
  let errorsTemplate = units.get('core.template.errors');
  let middlewares = this.middlewares;

  return function(ctx) {
    for (let m in middlewares) {
      ctx = middlewares[m](ctx, units);
    }

    let args = [ ctx.auth, ctx.data ];

    if (ctx.pathMatchResult) {
      args = args.concat(ctx.pathMatchResult.slice(1));
    }

    args.push(renderToResponse(ctx, errorsTemplate));
    view.get.apply(view, args);
  };
};

Contract.prototype.use = function(name) {
  if (!this.middlewares.length) {
    this.middlewares.push(require('./middlewares/empty'));
  }

  let middleware;
  try {
    middleware = require(middlewarePath + '/' + name);
  } catch (e) {
    middleware = require('./middlewares/' + name);
  }

  this.middlewares.push(middleware);
  return this;
};


module.exports = Contract;
