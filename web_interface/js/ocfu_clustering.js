var data_set;
var paper;
var image;
var myImg;
var imgURL;
var clusters = [];
var to_cluster_g;
var svg;
var pt;
var cursorPoint;
var colony_sets;
var color_picker_colors = ["rgba(255,0,0,0.3)", "rgba(0,255,0,0.3)", "rgba(0,0,255,0.3)", "rgba(255,255,0,0.3)", "rgba(255,0,255,0.3)"];
var manual_colony_arrays = [];
var urlParams;
var extra_data;
var run_first_ocfu = true;

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

$(document).ready(function(){
	for (var i=0; i < max_clusters; i++) {
		manual_colony_arrays[i] = [];
	};
	
	$('#slider_k').slider().on("slideStop", function(ev) {
		add_color_sliders(ev.value);
		cluster(to_cluster_g, ev.value, draw_colonies);
	});


	//load appropriate image into canvas
	$.getJSON(api_server + "/get_plate/" + urlParams['token'], function(data){
		extra_data = data;

		//load image 
		imgURL = api_server + '/' +  extra_data.filename;
		myImg.src = imgURL;


		//setup clustering params if we have some saved
		if (extra_data['clustering_params']) {
			var num_clusters = parseInt(extra_data['clustering_params']['kmeans_k']);

			console.log("hello????");
			$('#slider_k').slider('setValue', num_clusters);


			//init color sliders
			for (var i=0; i< num_clusters; i++) {
				var temp_color = extra_data['clustering_params']['clust_color_{0}'.format(i)];
				if(temp_color) {
					color_picker_colors[i] = temp_color;
				};
			};

			add_color_sliders(num_clusters);

			for(var i=0; i<num_clusters; i++){
				clusters.push([]);
			};

			//setup colonies if we have them already saved!
			if(extra_data['colonies']) {
				data_set = JSON.parse(extra_data['colonies']);
				run_first_ocfu = false;
			};

		} else {
			add_color_sliders(1);

		};

		//TODO Get some more data here??
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

	$('#save_colonies').click(function(e) {
		var to_save = {colonies: JSON.stringify(data_set)};


		var cluster_data_array = $("#kmeans_form").serializeArray();
		var cluster_data_obj = {};

		_.forEach(cluster_data_array, function(param_obj, param_idx, param_list) {
			cluster_data_obj[param_obj['name']] = param_obj['value'];
		});

		to_save['clustering_params'] = cluster_data_obj;

		console.log(cluster_data_obj);

		$.post(api_server + '/save_colonies/' + urlParams['token'], to_save, function(data) {

			return;
		});

	});

	paper = Raphael(0,0, canvas_width, canvas_height);
	colony_sets = [paper.set()];


	//classify plate!
	//TODO: only do this if we don't have data already??
	$.getJSON( api_server + "/run_open_cfu/" + urlParams['token'], function(data){

		if(run_first_ocfu) {
			console.log("abbount to run");

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
			cluster(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
			update_cluster_counters();
		} else {
			draw_colonies();
			update_cluster_counters();
		};

	});


	$('#hide_controls').click(function(d) {
		$('.controls').css("zIndex", 0);
		d.preventDefault();

	})

	$('#show_controls').click(function(d) {
		$('.controls').css("zIndex", 100);
		d.preventDefault();

	})


	//TODO: Save ocfu params to database here!
	$('#run_ocfu').click(function(d) {
		//disable Controls while waiting for response

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
			cluster(to_cluster, $('#slider_k').slider('getValue'), draw_colonies);
			update_cluster_counters();

		});

		d.preventDefault();

	});


	myImg = new Image();

	myImg.onload = function() {
		myImg.style

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

var add_colony = function(colony_object, cluster_index) {
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
		new_picker.id = "clust_color_" + i;
		new_picker.name = "clust_color_" + i;
		new_picker.value=color_picker_colors[i];
		$(color_div).append(new_picker);

		var cp = $(new_picker).colorpicker({format: "rgba"});
		cp.on("changeColor", function(ev) {
			color_picker_colors[this.cluster_id] = ev.color.toString();
			draw_colonies();
	 	});
	};

	add_cluster_counters(num_sliders);

	for (var i=0; i<num_sliders;i++) {
		colony_sets.push(paper.set());
	};

};


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
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}


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

	_.forEach(data_set, function (colony, colony_index, colony_set) {
		if(colony.IsValid) {
			draw_colony(data_set[colony_index], colony_index);
		};
	});

	if(callback) callback();

};