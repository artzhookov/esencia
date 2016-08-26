'use strict';

var _ = require('underscore');
var backbone = require('backbone');
var componentsManager = require('../utils/componentsManager');

/**
 * @class Esencia.Router
 * @extend Backbone.Router
 */

var Router = {
	// root: '/',
	componentsManager: componentsManager,
	namedParameters: false,
	nowhereUrl: '___',
	autoloadModules: true,
	modulesPath: 'modules/',
	defaultModuleName: 'main',
	onModuleError: function() {}
};

var routerOptions = [
	// 'root',
	'componentsManager', 'namedParameters', 'nowhereUrl',
	'autoloadModules', 'modulesPath', 'defaultModuleName', 'onModuleError'
];

/**
 * @constructor
 * @param {Object} [options]
 */

Router.constructor = function(options) {
	options = options || {};

	// populate Router instance with fields from options
	_.extend(this, _.pick(options, routerOptions));
	// save original options, it is sometimes usefull
	this.options = options;

	this.urlParams = {};
	this.modules = {};

	// All query parameters can be passed in a single hash using the key
	// referenced from the route definition (backbone queryparams will
	// do it for us)
	backbone.Router.namedParameters = this.namedParameters;

	backbone.Router.apply(this, arguments);

	if (options.autoloadModules) {
		this.route('*url', function(params) {
			this.setModule(params);
		});
	}
};

/**
 * Extend all arguments to single object and replace urlParams with it
 *
 * @param {Object | Function} params1
 * @param {Object | Function} params2
 * etc. ...
 */

Router._populateUrlParams = function(/* params1, params2, ... */) {
	var self = this;

	// clean old values from urlParams object
	var key;
	for (key in this.urlParams) {
		if (_.has(this.urlParams, key)) {
			delete this.urlParams[key];
		}
	}

	// populate urlParams with new params
	_(arguments)
		.chain()
		.filter(_.isObject)
		.each(function(params) {
			params = _.isFunction(params) ? params.call(self) : params;
			_.extendOwn(self.urlParams, params);
		});

	return this.urlParams;
};

/**
 * Add new component to components manager
 *
 * @param {Object} options - component options
 */

Router.component = function(options) {
	return this.componentsManager.add(options);
};

/**
 * Override `route` to add middleware processing functionality
 *
 * @override
 */

Router.route = function(url, options, callback) {
	var self = this;

	if (_.isFunction(options)) {
		callback = options;
		options = {};
	}

	if (!_.isObject(options)) {
		options = {name: options};
	}

	var name = '';

	if (_.has(options, 'components') || _.has(options, 'component')) {
		var components = _(options.components || [options.component])
			.map(function(componentOptions) {
				return self.component(componentOptions);
			});

		var componentNames = _.pluck(components, 'name');

		name = componentNames.join(',');

		// create callback to process components tree
		callback = function() {
			self.componentsManager.process(componentNames);
		};
	}

	name = options.name || name;

	// bind component to route
	backbone.Router.prototype.route.call(this, url, name, function() {
		var args = arguments;

		self._populateUrlParams(options.defaultUrlParams, args[0]);

		self._defaultMiddleware({
			url: url,
			name: name,
			callback: callback
		}, function() {
			callback.apply(self, args);
		});
	});
};

/**
 * Override `navigate` to add force mode and qs processing
 *
 * @override
 * @param {String} fragment
 * @param {Object} [options] - hash of params
 * @param {Object} [options.qs] - query string hash
 */

Router.navigate = function(fragment, options) {
	options = options || {};

	// if (fragment.indexOf(this.root) === 0) {
	// 	fragment = fragment.substring(this.root.length);
	// }

	// force to go to the selected fragment even if we currently on it
	if (options.force) {
		this.navigate(this.nowhereUrl, {
			replace: options.replace,
			trigger: false
		});

		options = _(options).chain().omit('force').extend({replace: true}).value();

		return this.navigate(fragment, options);
	}

	// set `trigger` to true by default
	options = _.defaults({}, options, {
		trigger: true,
		params: {}
	});

	// add support of query string using `toFragment` from backbone.queryparams
	var qs = options.qs;

	if (this.toFragment && qs) {
		// reject undefined and null qs parameters
		_(qs).each(function(val, key, qs) {
			if (val === undefined || val === null) delete qs[key];
		});

		fragment = this.toFragment(fragment, qs);

		delete options.qs;
	}

	backbone.Router.prototype.navigate.call(this, fragment, options);
};


/**
 * Default middleware function
 */

Router._defaultMiddleware = function(route, next) {
	next();
};

/**
 * Use passed function as `middleware`
 *
 * @param {Function} middleware - middleware function,
 * `route` and `next` will be passed as arguments.
 * context (`this`) is link to the router object.
 */

Router.middleware = function(middleware) {
	var self = this;

	var defaultMiddleware = this._defaultMiddleware;

	this._defaultMiddleware = function(route, next) {
		defaultMiddleware.call(self, route, function() {
			middleware.call(self, route, next);
		});
	};

	return this;
};

/**
 * Require module file and init it
 *
 * @param {Object} params
 * @param {String} params.url - url without query string
 */

Router.setModule = function(params) {
	var self = this;

	var url = params.url;
	delete params.url;

	var moduleName = _(url.split('/')).find(_.identity) || this.defaultModuleName;

	// require module file
	require([this.modulesPath + moduleName], function(moduleInit) {
		// if module is loaded first time
		if (!self.modules[moduleName]) {
			// init it
			moduleInit(self);

			// set module init flag to true
			self.modules[moduleName] = true;

			// and navigate again with force flag
			self.navigate(url, {
				replace: true,
				force: true,
				qs: params
			});
		}
	}, this.onModuleError);
};

module.exports = backbone.Router.extend(Router);