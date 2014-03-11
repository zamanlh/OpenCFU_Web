var data_set;
var paper;
var image;
var myImg;
var imgURL;
var clusters;
var to_cluster_g;
var svg;
var pt;
var cursorPoint;
var colony_sets;
var color_picker_colors = ["rgba(255,0,0,0.3)", "rgba(0,255,0,0.3)", "rgba(0,0,255,0.3)", "rgba(255,255,0,0.3)", "rgba(255,0,255,0.3)"];


$(document).ready(function(){	
	$('#context_menu').hide();
	$('#slider_radius').slider();
	$('#slider_threshold').slider();

	$('#slider_k').slider().on("slideStop", function(ev) {
		add_color_sliders(ev.value);
		cluster(to_cluster_g, ev.value, draw_colonies);
	});
	
	paper = Raphael(0,0, canvas_width, canvas_height);
	colony_sets = [paper.set()];

	//init color sliders
	add_color_sliders($('#slider_k').slider('getValue'));

	//classify plate!
	$.getJSON( api_server + "/run_open_cfu/" + urlParams['token'], function(data){
		clustering_enabled(false);

		var to_cluster = [];

		data_set = data;
		_.forEach(data, 
			function(val, index, collection) {
				if (val['IsValid'] && val['Cluster_Index'] == undefined)
				{
					var tmp = [val['Hue'], val['Saturation'], val['Rmean'], val['Gmean'], val['Bmean']]
					tmp.idx = index

					to_cluster.push(tmp);
				}
			});
		
		//TODO - recalc this?

		to_cluster_g = to_cluster;
		clustering_enabled(true);
		cluster(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
	});

	$('#hide_controls').click(function(d) {
		console.log('hello??');
		$('.controls').css("zIndex", 0);
		d.preventDefault();
	})

	$('#show_controls').click(function(d) {
		$('.controls').css("zIndex", 100);
		d.preventDefault();
	})

	$('#run_ocfu').click(function(d) {
		clustering_enabled(false);
		//disable Controls while waiting for response?

		//remove old circles
		$('circle').remove();

		//classify plate!


		$.getJSON(api_server + "/run_open_cfu/" + urlParams['token']+ "?" + $("#ocfu_form").serialize(), function(data){
			var to_cluster = [];

			data_set = data;
			_.forEach(data, 
				function(val, index, collection) {
					if (val['IsValid'])
					{
						var tmp = [val['Hue'], val['Saturation'], val['Rmean'], val['Gmean'], val['Bmean']]
						tmp.idx = index

						to_cluster.push(tmp);
					}
				});

			to_cluster_g = to_cluster;
			clustering_enabled(true);
			cluster(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
		});

		d.preventDefault();
	});


	myImg = new Image();

	myImg.onload = function() {

		svg = document.querySelector('svg');
		pt = svg.createSVGPoint();

		// Get point in global SVG space
		cursorPoint = function(evt){
		  pt.x = evt.clientX; 
		  pt.y = evt.clientY;
		  return pt.matrixTransform(svg.getScreenCTM().inverse());
		};

		var img = paper.image(imgURL, 0,0, myImg.width, myImg.height);
		paper.setViewBox(0, 0, myImg.width, myImg.height);

		img.click(function(e) {
			$('#context_menu').offset({left:e.pageX + 5, top:e.pageY + 5});
			$('#context_menu').show(); 
			console.log("colony NOT clicked!");
			
			var cluster_selector = $('#cluster_selector');

			cluster_selector.empty();

			var _this = this;
			for (var i=0;i < clusters.length; i++) {
				var clust_button = document.createElement("button");
				clust_button.className = "btn btn-primary cluster_button";
				clust_button.cluster_index = i;
				clust_button.style.backgroundColor = rgba_opaque(color_picker_colors[i]);
				$(clust_button).click(function(inner_e) {
					var real_point = cursorPoint(e);
					console.log(inner_e);
					console.log(this.cluster_index);
					console.log(_this);
					add_colony(real_point.x, real_point.y, this.cluster_index);
					draw_colony(real_point.x , real_point.y, added_colony_radius, this.cluster_index, update_cluster_counters);

					$('#context_menu').hide(); 

					inner_e.preventDefault();
				});

				cluster_selector.append(clust_button);
			};

			e.preventDefault();

		});
	};
});


var add_colony = function(x, y, cluster_index, callback) {
	//save to data_set or just save to database and have the callback refresh the dataset?

	colony = {X: x, Y:y, IsValid:1, Cluster_Index:cluster_index};
	console.log(colony)
};

var draw_colony = function(x, y, radius, cluster_index) {
	console.log("adding: {0}, {1}, {2}".format(x, y, cluster_index));
	colony_sets[cluster_index].push(
		//magic number?
		paper.circle(x, y, radius)
		.data("cluster_index", cluster_index)
		.attr("stroke-width", 1)
		.attr("fill", color_picker_colors[cluster_index])
		.click(function(d) { 
			//$('#context_menu').offset({left:d.x + 5, top:d.y + 5});
			//$('#context_menu').show(); 
			console.log("colony clicked!");

			//TODO
			//change cluster?
			//remove
			//split?

			d.stopPropagation()

		})
	);
	update_cluster_counters();
};	

var rgba_opaque = function(rgba_col) {
	return rgba_col.replace(/[^,]+(?=\))/, '1.0')
};

var update_cluster_counters = function()
{
	_.forEach(clusters, function (cluster_val, cluster_index, cluster_coll) {
		//update label with counts;
		$('#cluster_badge' + cluster_index).text(colony_sets[cluster_index].length);
		$('#cluster_badge' +cluster_index).css('background-color', rgba_opaque(color_picker_colors[cluster_index]));
	});
}


var add_cluster_counters = function(num_counters) {
	$('.cluster_label').remove();
	var cluster_label_div = $('#cluster_label_div');

	for (var i=0; i < num_counters; i++) {
		var c_badge = document.createElement('span');
		c_badge.className="badge cluster_label stroked";
		c_badge.cluster_id = i;
		c_badge.id = "cluster_badge" + i;
		c_badge.style.fontSize="24px"
		$(c_badge).text("");

		cluster_label_div.append(c_badge);
	};
};

var clustering_enabled = function(bool_enable) {
	if(bool_enable) {
		$('#kmeans_fieldset').prop("disabled", false);
		$('#slider_k').slider('enable');
		$('#cluster_label_div').show();
	
	} else {
		$('#kmeans_fieldset').prop("disabled", true);
		$('#slider_k').slider('disable');
		$('#cluster_label_div').hide();
	};
};

var add_color_sliders = function(num_sliders) {
	$('.colorp').remove();

	var color_div = $('#cluster_colors');

	console.log("adding color sliders!");
	console.log(color_div);

	for (var i=0; i < num_sliders; i++) {
		var new_picker = document.createElement('input');
		new_picker.className="colorp";
		new_picker.cluster_id = i;
		new_picker.id = "clust_color" + i;
		new_picker.value=color_picker_colors[i];
		$(color_div).append(new_picker);

		var cp = $(new_picker).colorpicker({format: "rgba"});
		cp.on("changeColor", function(ev) {
			color_picker_colors[this.cluster_id] = ev.color.toString();
			draw_colonies(clusters);
	 	});
	};

	add_cluster_counters(num_sliders);

	colony_sets = [];
	for (var i=0; i<num_sliders;i++) {
		colony_sets.push(paper.set());
	};

};

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
	String.prototype.format = function() {
 		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
			? args[number]
			: match
			;
		});
	};
}






var urlParams;

(window.onpopstate = function () {
	var match,
	pl = /\+/g,  // Regex for replacing addition symbol with a space
	search = /([^&=]+)=?([^&]*)/g,
		decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
		query  = window.location.search.substring(1);

	urlParams = {};
	while (match = search.exec(query))
		urlParams[decode(match[1])] = decode(match[2]);
})();


var cluster = function (array_to_cluster, k, callback) {		
	var t_clusters = clusterfck.kmeans(array_to_cluster, k);

	if(callback) { callback(t_clusters); }

};


//split up assigning clusters from what should be drawn!
//TODO: we're only drawing things that w're clustering -- not things that have already been clusterd
var draw_colonies = function(d_clusters, callback) {
	 $('circle').remove();

	 //TODO use these to count
	 _.forEach(colony_sets, function (set) {set.clear();});

	clusters = d_clusters;	
	_.forEach(d_clusters, function (cluster_val, cluster_index, cluster_coll) {
		_.forEach(cluster_val, function (colony_val, colony_index, colony_coll) {
			var val = data_set[colony_val.idx];
			draw_colony(val['X'], val['Y'], val['Radius'], cluster_index);
		});
	});

	if(callback) callback();

};

//load appropriate image into canvas
$.getJSON(api_server + "/get_plate/" + urlParams['token'], function(data){
	imgURL = api_server + '/' +  data.filename;
	myImg.src = imgURL;
});

