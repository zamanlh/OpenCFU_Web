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
var manual_colony_arrays = [];

$(document).ready(function(){
	for (var i=0; i < max_clusters; i++) {
		manual_colony_arrays[i] = [];
	};


	//load appropriate image into canvas
	$.getJSON(api_server + "/get_plate/" + urlParams['token'], function(data){
		imgURL = api_server + '/' +  data.filename;
		myImg.src = imgURL;
	});

	$('#cancel_context').click(function(e) {
		$(context_menu).hide(); 
		$('#remove_colony_div').hide();
		//e.preventDefault(); 
	});

	$('#context_menu').hide();
	$('#remove_colony_div').hide();

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

		//TODO: LOAD MANUALLY CLASSIFIED COLONIES SEPERATELY???
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
		
		to_cluster_g = to_cluster;
		clustering_enabled(true);
		cluster(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
	});

	$('#hide_controls').click(function(d) {
		$('.controls').css("zIndex", 0);
		d.preventDefault();

	})

	$('#show_controls').click(function(d) {
		$('.controls').css("zIndex", 100);
		d.preventDefault();

	})

	$('#run_ocfu').click(function(d) {
		//disable Controls while waiting for response
		clustering_enabled(false);

		//remove old circles
		$('circle').remove();


		//TODO - Reset manual_colony_arrays?
		for (var i=0; i < max_clusters; i++) {
			manual_colony_arrays[i] = [];
		};

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
			console(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
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
			console.log([e.pageX, e.pageY]);
			$('#context_menu').show(); 
			$('#context_menu').offset({left:e.pageX + 5, top:e.pageY + 5});

			console.log($('#context_menu').offset());
			
			var cluster_selector = $('#cluster_selector');
			var cluster_selector_text = $('#cluster_selector_text')
			cluster_selector_text.text("Add Colony");

			cluster_selector.empty();

			var _this = this;
			for (var i=0;i < clusters.length; i++) {
				var clust_button = document.createElement("button");
				clust_button.className = "btn btn-primary cluster_button";
				clust_button.cluster_index = i;
				clust_button.style.backgroundColor = rgba_opaque(color_picker_colors[i]);
				$(clust_button).click(function(inner_e) {
					var real_point = cursorPoint(e);
					var new_col_idx = add_colony({X:real_point.x, Y:real_point.y, Radius:15}, this.cluster_index);
					console.log(new_col_idx);
					draw_colony(data_set[new_col_idx], new_col_idx);

					$('#context_menu').hide(); 


					inner_e.preventDefault();

				});

				cluster_selector.append(clust_button);
			};

			e.preventDefault();
			//return false;
		});
	};
});



var remove_colony = function(colony_element) {
	console.log(colony_element);
};

var add_colony = function(colony_object, cluster_index) {
	//save to data_set or just save to database and have the callback refresh the dataset?

	var colony = {X: colony_object.X, Y:colony_object.Y, IsValid:1, Radius:colony_object.Radius, Cluster_Index:cluster_index, Clustered_Manually:true};
	data_set.push(colony); //where is this

	return data_set.length - 1;
};

var draw_colony = function(colony_object, data_set_index) {
	colony_sets[colony_object.Cluster_Index].push(
		paper.circle(colony_object.X, colony_object.Y, colony_object.Radius)
		.data("cluster_index", colony_object.Cluster_Index)
		.data("data_set_index", data_set_index)
		.attr("stroke-width", 0.3)
		.attr("fill", color_picker_colors[colony_object.Cluster_Index])
		.click(function(e) { 
			//$('#context_menu').offset({left:d.x + 5, top:d.y + 5});
			//$('#context_menu').show(); 
			$('#context_menu').show(); 
			$('#context_menu').offset({left:e.pageX + 5, top:e.pageY + 5});

			
			var cluster_selector = $('#cluster_selector');

			var cluster_selector_text = $('#cluster_selector_text')

			var button_group_selector = $('#button_group');

			var remove_colony_div = $('#remove_colony_div');

			var remove_colony_btn = $('#remove_colony_btn');

			cluster_selector_text.text("Reclassify Colony");
			
			cluster_selector.empty();


			remove_colony_div.show();

			//clicked colony
			var clust_idx = this.data("cluster_index");	
			var data_set_index = this.data("data_set_index");

			var _this = this;
			for (var i=0;i < clusters.length; i++) {
				var clust_button = document.createElement("button");
				clust_button.className = "btn btn-primary cluster_button";
				clust_button.cluster_index = i;
				clust_button.style.backgroundColor = rgba_opaque(color_picker_colors[i]);
				$(clust_button).click(function(inner_e) {
					
					data_set[data_set_index].Cluster_Index = this.cluster_index;
					draw_colonies();
					update_cluster_counters();

					$(context_menu).hide(); 
					$('#remove_colony_div').hide();


					inner_e.preventDefault();

				});

				cluster_selector.append(clust_button);
			};

			$(remove_colony_btn).click(function(inner_e) {
				//delete colony for reals
				colony_sets[clust_idx].exclude(_this);
				data_set[data_set_index].IsValid = false;
				_this.remove();
				update_cluster_counters();
				$(context_menu).hide(); 
				$('#remove_colony_div').hide();

			});


			e.stopPropagation();

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
		$('#ocfu_fieldset').prop("disabled", false);
		$('#slider_k').slider('enable');
		$('#cluster_label_div').show();
		$('#slider_radius').slider('enable');
		$('#slider_threshold').slider('enable');
	
	} else {
		$('#kmeans_fieldset').prop("disabled", true);
		$('#slider_k').slider('disable');
		$('#cluster_label_div').hide();
		$('#ocfu_fieldset').prop("disabled", true);
		$('#slider_radius').slider('disable');
		$('#slider_threshold').slider('disable');
	};
};

var add_color_sliders = function(num_sliders) {
	$('.colorp').remove();

	var color_div = $('#cluster_colors');

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

	//manual_colony_arrays = [];
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
	clusters = t_clusters;


	_.forEach(t_clusters, function (cluster_val, cluster_index, cluster_coll) {
		_.forEach(cluster_val, function (colony_val, colony_index, colony_coll) {
			data_set[colony_val.idx].Cluster_Index = cluster_index;
		});
	});

	if(callback) { callback(); }

};


var draw_colonies = function(callback) {
	 $('circle').remove();

	_.forEach(colony_sets, function (set) {set.clear();});

	//TODO Bad syntax
	_.forEach(data_set, function (colony, colony_index, colony_set) {
		if(colony.IsValid) {
			draw_colony(data_set[colony_index], colony_index);
		};
	});

	if(callback) callback();

};