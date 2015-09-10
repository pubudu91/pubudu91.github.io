var PropNets = (function(d3) {
  var MOD = MOD || {};
  var decodedShapeFile;
  var startTime;
  var width; // width of the map canvas
  var height; // height of the map canvas
  var projection;
  var svgMap;
  var g;
  var path;
  var zoom;
  var currentMap;

  /* variables representing the various DOM elements in the HTML view */
  var filesDOM;
  var drawMapDOM;
  var selectfileDOM;

  /* variables representing data related to the visualizations */

  /*
   * This variable holds the parsed CSV file containing the flow data and the status
   * updates. Any flow data required can and should be accessed through this.
   */
  var flowdata;

  /*
   * This variable holds the parsed CSV file containing the network data
   * This only holds details related to the nodes used in the network and the
   * weights of the edges connecting them.
   */
  var csvdata;
  var networklayout = {};
  var maxweight, minweight;

  /* MAP COLOURS */
  var basecolour = '#f7d1ad';
  var colourgradient;// = ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(165,15,21)', 'rgb(103,0,13)'];
  var gradientMapper;
  var lineSegmentColour = '#000';

  /* CURRENT MAP */
  var currentMapProperties = {}; // Available set of properties for the currently selected map
  var locationNames = []; // All the properties in the current map which contains the phrase: NAME
  var currentNameScheme; // Currently selected naming scheme
  var currentMapJSON; // GEOJson of the current map

  /* ANIMATION */
  var totalDuration = 30000; // Total duration of the animation. Default = 30 secs
  var segmentDuration = 5000; // Duration of the animation of a single segment. Default = 5 secs
  var regionDuration = 500; // Duration of the animation of a region colouring. Default = 500 ms
  var strokeWidth = 2; // Width of the animted line segmens. Default = 2 px
  var strokeLength = 50; // Length of the animted line segmens. Default = 50 px
  var maxLengthChecked = false;

  /* GOOGLE MAP */
  var gmap;
  var gmapLat, gmapLng;
  var gmapEnabled = false;
  var opacity;

  MOD.setData = function(data) {
    flowdata = data;
    // console.log(flowdata);
  };

  //********************************* PropNets Initializing Function ***********************************

  MOD.init = function(f, u, s) {
    /*
     * When a file is added by the user, check if the shape file contains several shape files in
     * one zip file. If so, provide the user with a drop down list to select which shape file
     * he wants to use
     */
    filesDOM = document.getElementById(f);
    drawMapDOM = document.getElementById(u);
    selectfileDOM = document.getElementById(s);

    //basecolour = colourgradient[0]; // initialize the base colour to the lightest colour in the colour gradient

    filesDOM.addEventListener('change', function(evt) {
      readShapeFile();
    }, false);

    // read the shape file and draw the map when the user clicks the Draw Map button
    drawMapDOM.addEventListener('click', function(evt) {
      if (decodedShapeFile == null)
        alert('Please select a file');
      else {
        var mapfile;
        currentMapProperties = [];

        if ($.isArray(decodedShapeFile)) {
          var i = parseInt(selectfileDOM.value);
          mapfile = decodedShapeFile[i];
          // console.log(mapfile.fileName);
          // console.log(mapfile.features);
        } else {
          mapfile = decodedShapeFile;
          // console.log(mapfile.fileName);
          // console.log(mapfile.features);
        }

        for (var key in mapfile.features[0].properties) {
          currentMapProperties.push(key);
        }

        locationNames = [];
        var nameSchemeSelect = document.getElementById('selectnamingscheme');
        nameSchemeSelect.options.length = 0;

        for (var i in currentMapProperties) {
          if (currentMapProperties[i].match(/NAME/i)) {
            locationNames.push(currentMapProperties[i]);

            var option = document.createElement('option');
            option.value = currentMapProperties[i];
            option.innerHTML = currentMapProperties[i];
            nameSchemeSelect.appendChild(option);
          }
        }

        currentNameScheme = nameSchemeSelect.options.length > 0 ? nameSchemeSelect.options[0].value : null; // CHECK: if having problems drawing maps without 'names'

        // console.log(locationNames);
        currentMap = mapfile.fileName.charAt(mapfile.fileName.length - 1) - '0';
        currentMapJSON = mapfile;

        drawMap(mapfile);
      }

    }, false);

    document.getElementById('selectnamingscheme').addEventListener('change', function() {
      currentNameScheme = this.value;
      drawMap(currentMapJSON);
    }, false);
  };

  //------------------------------- END of PropNets Initializing Function -------------------------------

  //------------------------------- READ SHAPE FILE FUNCTION -------------------------------
  function readShapeFile() {
    if (!filesDOM || filesDOM.files.length <= 0) {
      alert('Please select a file!');
      return;
    }

    var reader = new FileReader();

    // If we use onloadend, we need to check the readyState.
    reader.onloadend = function(evt) {
      if (evt.target.readyState === FileReader.DONE) { // DONE == 2
        console.log('file passed on to the shape file reader');

        // pass the shape file read, to the shapefile js library to convert it to geojson
        shp(reader.result).then(function(geojson) {
          var endTime = new Date().getTime();
          console.log('file reading completed: ' + ((endTime - startTime) / 1000.0) + ' s elapsed');

          reset(); // reset all the variables before drawing the new map

          /*
           * if the geojson object contains several maps, add a dropdown list to select
           * the desired map to draw
           */
          if ($.isArray(geojson)) {
            var selectfile = document.getElementById('selectfile');

            for (var i = 0; i < geojson.length; i++) {
              var option = document.createElement('option');
              option.value = i;
              option.innerHTML = geojson[i].fileName; // assign the file name of the shape file as the option name
              selectfile.appendChild(option);
            }

            selectfile.hidden = false; // display the dropdown list
          }
          // console.log(geojson);
          decodedShapeFile = geojson;
          document.getElementById('upload').disabled = false; // enable the draw map button
        });
      }
    };

    console.log('Starting to read the file');
    startTime = new Date().getTime();
    reader.readAsArrayBuffer(filesDOM.files[0]);
  }
  //------------------------------- END of READ SHAPE FILE FUNCTION -------------------------------

  // --------------------        DRAW MAP FUNCTION           --------------------------
  function drawMap(json) {
    console.log('Starting to draw');
    startTime = new Date().getTime();

    var header = document.getElementById('header');

    width = $(window).width() - 17;
    height = $(window).height() - header.clientHeight - 5;

    d3.select('#mainmap').remove();
    d3.select('#container').append('div').attr('id', 'mainmap');
    svgMap = d3.select('#mainmap').select('svg').remove();

    svgMap = d3.select('#mainmap').append('svg')
      .attr('width', width)
      .attr('height', height);


    // Create a unit projection.
    projection = d3.geo.mercator()
      .scale(1)
      .translate([0, 0]);

    // Create a path generator.
    path = d3.geo.path().projection(projection);

    // Compute the bounds of a feature of interest, then derive scale & translate.
    var b = path.bounds(json),
      s = 0.95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
      t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

    // Update the projection to use computed scale & translate.
    projection.scale(s)
      .translate(t);

    var zoom = d3.behavior.zoom()
      .translate([0, 0])
      .scale(1)
      .scaleExtent([0.5, 15])
      .on('zoom', zoomed);

    g = svgMap.append('g');

    var tip = setupToolTips();

    svgMap.call(zoom);
    g.call(tip);

    //'#' + ((1 << 24) * Math.random() | 0).toString(16);
    appendPathData();
    g.selectAll('path')
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);


    var endTime = new Date().getTime();
    console.log('drawing complete: ' + ((endTime - startTime) / 1000.0) + ' s elapsed');
  }
  // ---------------------------- END OF DRAW MAP FUNCTION -------------------------------------

  function appendPathData() {
    g.selectAll('path').data(currentMapJSON.features).enter().append('path')
      .attr('d', path)
      .attr('class', function(d) {
        return 'subunit ' + (currentNameScheme == null ? '' : d.properties[currentNameScheme].toLowerCase());
      })
      .attr('name', function(d) {
        return (currentNameScheme == null ? '' : d.properties[currentNameScheme].toLowerCase());
      })
      .style('fill', basecolour)
      .style('stroke-width', '1')
      .style('stroke', 'black')
      .style('vector-effect', 'non-scaling-stroke');
    // .on('mouseover', tip.show)
    // .on('mouseout', tip.hide);
  }

  function setupToolTips() {
    var tip = d3.tip().attr('class', 'd3-tip')
      .html(function(d) {
        return currentNameScheme == null ? '' : d.properties[currentNameScheme];
      });

    var placeToolTip = function(d) {
      var bbox = path.bounds(d);
      var centroid = path.centroid(d);

      var width = bbox[1][0] - bbox[0][0];
      // var height = bbox[1][1] - bbox[0][1];

      var voffset = (centroid[1] - bbox[0][1]);
      var hoffset = (centroid[0] - bbox[0][0]) - width / 2;
      return [voffset, hoffset];
    };

    tip.offset(placeToolTip);

    return tip;
  }

  function addLegend() {
    var legendRectSize = 20;
    var legendSpacing = 4;

    svgMap.selectAll('.legend').remove(); // Remove any previous legends, before adding the new one

    var legend = svgMap.selectAll('.legend')
      .data(gradientMapper.range())
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', function(d, i) {
        var horz = 40; //-2 * 18;
        var vert = height - (i + 1) * 20; //i * 360 - offset;
        return 'translate(' + horz + ',' + vert + ')';
      });

    legend.append('rect')
      .attr('width', legendRectSize)
      .attr('height', legendRectSize)
      .style('fill', function(colour) {
        return colour;
      });

    legend.append('text')
      .attr('x', legendRectSize + legendSpacing)
      .attr('y', legendRectSize - legendSpacing)
      .text(function(d) {
        var index = colourgradient.indexOf(d);
        var maxweight = getMaxWeight();
        var unitsize = maxweight / colourgradient.length;

        if (index == 0)
          return '0 - ' + Math.ceil(unitsize);

        if (index == (colourgradient.length - 1))
          return String.fromCharCode(62) + ' ' + Math.ceil(index * unitsize);

        return String.fromCharCode(8804) + ' ' + Math.ceil((index + 1) * unitsize);
      });
  }

  //------------------------------------ VISUALIZE FUNCTION --------------------------------------------

  MOD.visualize = function() {
    if (flowdata == null) {
      alert('No flow data available for visualizing. Please add a flow data file');
      return;
    }

    if (csvdata == null) {
      alert('Please add/confirm a network layout file');
      return;
    }

    /* Remove any left over effects from the previous animation */
    g.selectAll('line').remove();
    g.selectAll('path').style('fill', basecolour);

    var baseTime = Date.parse(flowdata[0].timestamp); // timestamp of the first record
    var maxTime = Date.parse(flowdata[flowdata.length - 1].timestamp); // timestamp of the last record

    maxweight = getMaxWeight(); // retrieve the maximum weight in the network before using it
    gradientMapper = d3.scale.quantize().domain([0, maxweight]).range(colourgradient); // Get the function which maps the weight to a colour

    addLegend(); // Legend is dependent on the gradientMapper

    for (var i = 0; i < flowdata.length; i++) {
      var relativeTime = Date.parse(flowdata[i].timestamp) - baseTime;
      var src = getDatumByName(flowdata[i].source);
      var dest = getDatumByName(flowdata[i].destination);
      var colour;

      connectLocations(src, dest, relativeTime / (maxTime - baseTime) * totalDuration);

      if (flowdata[i].source_infected.toLowerCase() == 'true') {
        // var colour = getColour(getWeight(flowdata[i].source, flowdata[i].destination), gradientUnitSize);
        colour = gradientMapper(getWeight(flowdata[i].source, flowdata[i].destination));
        animateRegionColouring(flowdata[i].source, colour, relativeTime, maxTime, baseTime);
      } else {
        animateRegionColouring(flowdata[i].source, basecolour, relativeTime, maxTime, baseTime);
      }

      if (flowdata[i].destination_infected.toLowerCase() == 'true') {
        colour = gradientMapper(getWeight(flowdata[i].source, flowdata[i].destination));
        animateRegionColouring(flowdata[i].destination, colour, relativeTime, maxTime, baseTime);
      } else {
        animateRegionColouring(flowdata[i].destination, basecolour, relativeTime, maxTime, baseTime);
      }
    }
  };

  //-------------------------- END OF VISUALIZE FUNCTION ----------------------------------------------------

  function animateRegionColouring(region, colour, relativeTime, maxTime, baseTime) {
    d3.select('[name=\"' + region.toLowerCase() + '\"]')
      .transition()
      .duration(500)
      .delay(relativeTime / (maxTime - baseTime) * totalDuration)
      .ease('linear')
      .style('fill', colour);
  }

  function connectLocations(src, dest, delay) {
    var centroid1 = path.centroid(src);
    var centroid2 = path.centroid(dest);

    var connector = g.append('line')
      .style('stroke', lineSegmentColour)
      .style('stroke-width', strokeWidth + 'px')
      .attr('x1', centroid1[0])
      .attr('y1', centroid1[1])
      .attr('x2', centroid2[0])
      .attr('y2', centroid2[1])
      .on('mouseover', function() {
        var line = d3.select(this);
        line.style('stroke', 'red')
          .style('stroke-width', '3px');
      })
      .on('mouseout', function() {
        var line = d3.select(this);
        line.style('stroke', lineSegmentColour)
          .style('stroke-width', strokeWidth);
      });

    // console.log(connector);
    var xdif = centroid2[0] - centroid1[0];
    var ydif = centroid2[1] - centroid1[1];
    var totalLength = Math.sqrt(xdif * xdif + ydif * ydif);
    // console.log('total line length: ' + totalLength);

    setupAnimation(connector, totalLength, delay);
  }

  function setupAnimation(connector, totalLength, delay) {
    var dashLength, factor, factor2;

    if (maxLengthChecked) {
      dashLength = totalLength;
      factor = 1;
      factor2 = 0;
    } else {
      dashLength = strokeLength;
      factor = 0;
      factor2 = 2;
    }

    connector
      .attr('stroke-dasharray', dashLength + ' ' + totalLength)
      .attr('stroke-dashoffset', (totalLength + dashLength * factor2))
      .transition()
      .duration(segmentDuration)
      .delay(delay)
      .attr('stroke-dashoffset', (totalLength + dashLength * factor2))
      .ease('linear')
      .attr('stroke-dashoffset', -totalLength + factor * totalLength);
  }

  // DATA VISUALIZATION PART

  MOD.readCSVFile = function(csvfiles) {

    var files = document.getElementById(csvfiles).files;

    if (!files.length) {
      alert('Please select a file!');
      return;
    }

    var file = files[0];
    var reader = new FileReader();

    // If we use onloadend, we need to check the readyState.
    reader.onloadend = function(evt) {
      if (evt.target.readyState == FileReader.DONE) { // DONE == 2
        var filetype = file.name.toLowerCase().split('.').pop();
        var temp = d3.csv.parse(evt.target.result);

        if (Object.keys(temp[0]).length == 3) {
          csvdata = temp;

          for (var i = 0; i < csvdata.length; i++) {
            var key = csvdata[i].location1.toLowerCase() + ':' + csvdata[i].location2.toLowerCase();
            networklayout[key] = csvdata[i].weight;
          }
        } else {
          flowdata = temp;
        }
      }
    };

    reader.readAsBinaryString(file);
  };

  // UTILITY FUNCTIONS
  function getWeight(loc1, loc2) {
    loc1 = loc1.toLowerCase();
    loc2 = loc2.toLowerCase();
    var val = (networklayout[loc1 + ':' + loc2] || networklayout[loc2 + ':' + loc1]);
    // console.log(val);

    // remove this later!
    if (isNaN(val))
      return parseInt(Math.random() * 1000);

    return val;
  }

  function getDatumByName(name) {
    // console.log(name.toLowerCase());
    var item = d3.select('[name=\"' + name.toLowerCase() + '\"]').datum();
    return item;
  }

  // function for handling the zooming
  function zoomed() {
    // projection.translate(d3.event.translate).scale(d3.event.scale);
    // g.selectAll("path").attr("d", path);
    g.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
    console.log('zoomed');
  }

  // function for resetting the map canvas
  function reset() {
    decodedShapeFile = null;
    projection = null;
    g = null;
    path = null;
    zoom = null;

    d3.select('#selectfile').selectAll('option').remove();
    document.getElementById('selectfile').hidden = true;
  }

  // function getColour(weight, unit) {
  //   var index = parseInt(weight / unit);
  //   // console.log('index: ' + index + ' ' + weight + ' ' + unit);
  //   if (index > (colourgradient.length - 1))
  //     index = colourgradient.length - 1;
  //
  //   return colourgradient[index];
  // }

  function getMaxWeight() {
    if (networklayout == null)
      return -1;

    var max = -1;

    for (var key in networklayout) {
      // console.log(networklayout[key]);
      if (networklayout[key] > max)
        max = networklayout[key];
    }
    return max;
  }

  MOD.refresh = function(id) {
    if (!id)
      return;

    document.getElementById(id).addEventListener('click', function() {
      if (currentMapJSON)
        drawMap(currentMapJSON);
    }, false);
  }

  MOD.changeBaseColour = function changeBaseColour(evt) {
    if (g == null)
      return;

    basecolour = evt.target.value;
    g.selectAll('path').style('fill', basecolour);
  }

  MOD.changeColourGradient = function changeColourGradient(d) {
    colourgradient = d.value[9];
    console.log(d.value[9]);
  }

  MOD.changeLineSegmentColour = function changeLineSegmentColour(evt) {
    if (g == null)
      return;

    lineSegmentColour = evt.target.value;
    g.selectAll('line').style('stroke', lineSegmentColour);
  }

  MOD.changeTotalDuration = function changeTotalDuration(evt) {
    totalDuration = parseInt(evt.target.value) * 1000; // Multiply by a factor of 1000 since we are using ms
    console.log('Duration: ' + totalDuration);
  }

  MOD.changeSegmentDuration = function changeSegmentDuration(evt) {
    segmentDuration = parseInt(evt.target.value) * 1000; // Multiply by a factor of 1000 since we are using ms
  }

  MOD.changeStrokeWidth = function changeStrokeWidth(evt) {
    strokeWidth = parseInt(evt.target.value);
    g.selectAll('line').style('stroke-width', strokeWidth);
  }

  MOD.changeStrokeLength = function changeStrokeLength(evt) {
    strokeLength = parseInt(evt.target.value);
  }

  MOD.changeOpacity = function changeOpacity(evt) {
    opacity = evt.target.value / 100;
    svgMap.attr('opacity', opacity);
  }

  MOD.useMaxLength = function useMaxLength(isUsed) {
    maxLengthChecked = isUsed;
  }

  MOD.enableGoogleMap = function enableGoogleMap(x) {
    if (gmap == null)
      gmap = x;

    gmapEnabled = true;
    gmap.resize();

    var b = path.bounds(currentMapJSON);

    //calculate the center of the bounding box of the map
    var center = [(b[1][0] - b[0][0]) / 2 + b[0][0], (b[1][1] - b[0][1]) / 2 + b[0][1]];

    // Get the latitude, longitude values of the center point
    var latLng = projection.invert(center);

    console.log(center);
    console.log(latLng);
    gmap.latitude = latLng[1];
    gmap.longitude = latLng[0];

    var topleft = projection.invert(b[0]);
    var bottomright = projection.invert(b[1]);
    console.log(topleft);
    console.log(bottomright);

    var bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(topleft[1], topleft[0]));
    bounds.extend(new google.maps.LatLng(bottomright[1], bottomright[0]));
    gmap.map.fitBounds(bounds);

    drawOverlay();
  }

  MOD.disableGoogleMap = function disableGoogleMap() {
    gmapEnabled = false;
    drawMap(currentMapJSON);
  }

  function drawOverlay() {
    var overlay = new google.maps.OverlayView();
    svgMap = d3.select('#mainmap').select('svg').remove();
    d3.select('#mainmap').remove();

    // document.getElementById('mainmap').style.visibility = 'hidden';
    overlay.onAdd = function() {
      console.log(this.getPanes().overlayLayer);
      var layer = d3.select(this.getPanes().overlayLayer).append("div").attr("class", "SvgOverlay").attr('id', 'mainmap');
      console.log(layer);
      svgMap = layer.append("svg")
        .attr('width', width)
        .attr('height', height)
        .attr('opacity', opacity);

      var adminDivisions = svgMap.append("g"); //.attr("class", "AdminDivisions");

      overlay.draw = function() {
        var markerOverlay = this;
        var overlayProjection = markerOverlay.getProjection();

        // Turn the overlay projection into a d3 projection
        var googleMapProjection = function(coordinates) {
          var googleCoordinates = new google.maps.LatLng(coordinates[1], coordinates[0]);
          var pixelCoordinates = overlayProjection.fromLatLngToDivPixel(googleCoordinates);
          return [pixelCoordinates.x + 4000, pixelCoordinates.y + 4000];
        }
        projection = googleMapProjection;
        path = d3.geo.path().projection(googleMapProjection);
        g = adminDivisions;
        appendPathData();
      };

    };

    overlay.setMap(gmap.map);
  }

  function googleProjection(prj) {
    return function(lnglat) {
      ret = prj.fromLatLngToDivPixel(new google.maps.LatLng(lnglat[1], lnglat[0]))
      return [ret.x, ret.y]
    };
  }

  return MOD;
}(window.d3));
