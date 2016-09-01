'use strict';

define([
	'esencia', 'common/base.view', './menu.view'
], function(Esencia, BaseView, MenuView) {
	return BaseView.extend({
		template: 'layout',
		views: {
			'#menu': MenuView
		},
		viewEvents: {
			'click #menu': 'onMenuClick'
		},
		setData: function() {
			this.getView('#menu').setData({
				selected: Esencia.history.fragment.match(/[^\?\/]+/)[0]
			});
		},
		onMenuClick: function(event) {
			event.preventDefault();
			Esencia.history.navigate(this.$(event.currentTarget).attr('href'), true);
		}
	});
});