/*
 * @class L.Streamline
 * @inherits L.Layer
 * @author Yuta Tachibana
 *
 * for leaflet v1.0
 *
 * requirements:
 *	streamline.js
 */

L.Streamline = L.Layer.extend({
	options: {
		onUpdate: function (){},
		onUpdated: function (){}
	},

	initialize: function (windData, options) {
		this._windData = windData;
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;
		this._width  = map.getSize().x;	
		this._height = map.getSize().y;	

		this._initLayer();

		// set events
		map.on('viewreset', this._update, this);
		map.on('moveend', this._update, this);
		map.on('movestart', this._startUpdate, this);
		map.on('zoomstart', this._startUpdate, this);

		// first draw
		this._update();
	},

	onRemove: function () {
		this._map.getPanes().overlayPane.removeChild(this._layer);
		this._map.off('viewreset');
		this._map.off('moveend');
	},

	_initLayer: function (){
		this._layer = L.DomUtil.create('div', 'streamline-layer');
		this._map.getPanes().overlayPane.appendChild(this._layer);

		this._maskCtx = this._initCanvas("streamline-layer-mask", 3);	
		this._streamCtx = this._initCanvas("streamline-layer-stream", 2);	
		this._streamCtx.globalAlpha = 0.9;

		this.streamline = new Streamline(
			{ x:[0, this._width], y:[0, this._height] },
			this._streamCtx
		);
		this.streamline.setMask(this._maskCtx, 100);
	},

	_initCanvas: function (id, zindex) {
		var canvas = document.createElement("canvas");
		canvas.id = id;
		canvas.width = this._width;
		canvas.height = this._height;
		canvas.style.zIndex = zindex;
		this._layer.appendChild(canvas);

		return canvas.getContext("2d");
	},

	_startUpdate: function (){
		if (!this._updating){
			this._updating = true;
			this.options.onUpdate();
			L.DomUtil.setOpacity(this._layer, 0);
		}
	},

	_update: function (){
		this._startUpdate();
		if (this._loading){
			// interrupt
			this._windData.abort();
			this.streamline.cancel();
		}
		this._loading = true;

		var bounds = this._map.getBounds(),
			zoom = this._map.getZoom(),
			scale = this._getScale(zoom);
		var _this = this;

		this._windData.getWindField(bounds, zoom, function (windField) {
			var origin = _this._map.getBounds().getNorthWest();
			var originPoint = _this._map.project(origin);

			function unproject (x, y) {
				return _this._map.unproject(originPoint.add([x, y]));
			}

			console.time("interpolate field");
			_this.streamline.setField(windField, unproject, scale, true);
			console.timeEnd("interpolate field");
			
			console.time("start animating");
			_this.streamline.animate();
			console.timeEnd("start animating");

			// show streamline
			var pos = _this._map.latLngToLayerPoint(origin);
			L.DomUtil.setPosition(_this._layer, pos);
			L.DomUtil.setOpacity(_this._layer, 1.0);

			// done
			_this._updating = false;
			_this._loading = false;
			_this.options.onUpdated();
		});
	},
	
	_getScale: function (zoom) {
		var scale = [0.3, 0.4, 0.6, 0.8, 1.0];
		return scale[zoom - 5];
	}
});

L.streamline = function() {
	return new L.Streamline();
};
