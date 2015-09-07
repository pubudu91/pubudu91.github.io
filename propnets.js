var PropNets = (function() {
  var MOD = MOD || {};
  var decodedShapeFile;
  var startTime;
  var width; // width of the map canvas
  var height; // height of the map canvas
  var projection;
  var g;
  var path;
  var zoom;
  var currentMap;

  /* variables representing the various DOM elements in the HTML view */
  var filesDOM;
  var uploadDOM;
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
  var colourgradient = ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(165,15,21)', 'rgb(103,0,13)'];

  MOD.setData = function(data) {
    flowdata = data;
    // console.log(flowdata);
  };

  MOD.init = function(f, u, s) {
    /*
     * When a file is added by the user, check if the shape file contains several shape files in
     * one zip file. If so, provide the user with a drop down list to select which shape file
     * he wants to use
     */
    filesDOM = document.getElementById(f);
    uploadDOM = document.getElementById(u);
    selectfileDOM = document.getElementById(s);

    filesDOM.addEventListener('change', function(evt) {
      // document.getElementById('upload').disabled = false; // enable the draw map button
      readShapeFile();
    }, false);

    // read the shape file and draw the map when the user clicks the Draw Map button
    uploadDOM.addEventListener('click', function(evt) {
      // readShapeFile();
      if (decodedShapeFile == null)
        alert('Please select a file');
      else {
        var mapfile;

        if ($.isArray(decodedShapeFile)) {
          var i = parseInt(selectfileDOM.value);
          drawMap(decodedShapeFile[i]);
          mapfile = decodedShapeFile[i];
          console.log(mapfile.fileName);
          console.log(mapfile.features);

          // for (var key in mapfile.features) {
          //   console.log(mapfile.features[key]['properties']['NAME_2']);
          // }
        } else {
          drawMap(decodedShapeFile);
          mapfile = decodedShapeFile;
          console.log(mapfile.fileName);
          console.log(mapfile.features);
        }
        currentMap = mapfile.fileName.charAt(mapfile.fileName.length - 1) - '0';
      }

    }, false);
  };

  function readShapeFile() {
    // var files = filesDOM.files;
    var files = document.getElementById('files');
    console.log(filesDOM.files);
    console.log(filesDOM.files[0]);

    if (filesDOM.files.length <= 0) {
      alert('Please select a file!');
      return;
    }

    var file = files[0];
    var reader = new FileReader();

    // If we use onloadend, we need to check the readyState.
    reader.onload = function(evt) {
      // if (evt.target.readyState === FileReader.DONE) { // DONE == 2
        console.log('file passed on to the shape file reader');
        console.log(evt.target);
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
            // drawMap(geojson[2]);
            var selectfile = document.getElementById('selectfile');

            for (var i = 0; i < geojson.length; i++) {
              var option = document.createElement('option');
              option.value = i;
              option.innerHTML = geojson[i].fileName; // assign the file name of the shape file as the option name
              selectfile.appendChild(option);
            }

            selectfile.hidden = false; // display the dropdown list
          }

          decodedShapeFile = geojson;
          document.getElementById('upload').disabled = false; // enable the draw map button
        });
      // }
    };

    console.log('Starting to read the file');
    startTime = new Date().getTime();
    reader.readAsArrayBuffer(filesDOM.files[0]);
  }

  // --------------------        DRAW MAP FUNCTION           --------------------------
  function drawMap(json) {
    console.log("Starting to draw");
    startTime = new Date().getTime();

    var header = document.getElementById('header');

    width = $(window).width() - 17;
    height = $(window).height() - header.clientHeight - 5;

    var map = d3.select('#map').select('svg').remove();

    map = d3.select('#map').append('svg')
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

    g = map.append('g');

    //   hover = function(d) {
    //       var bbox = path.bounds(d);
    //       var centroid = path.centroid(d);
    //
    //       var div = document.getElementById('tooltip');
    //
    //       div.style.left = centroid[0] +'px';
    //       div.style.top = centroid[1] + 'px';
    //
    //       div.innerHTML = d.properties.NAME_1;
    //       console.log(d.properties.NAME_1);
    //   };
    var tip = setupToolTips();

    map.call(zoom);
    g.call(tip);

    //'#' + ((1 << 24) * Math.random() | 0).toString(16);
    g.selectAll('path').data(json.features).enter().append('path')
      .attr('d', path)
      .attr('class', function(d) {
        return 'subunit ' + d.properties.NAME_1.toLowerCase();
      })
      .attr('name', function(d) {
        return d.properties.NAME_1.toLowerCase();
      })
      .style('fill', basecolour)
      .style('stroke-width', '1')
      .style('stroke', 'black')
      .style('vector-effect', 'non-scaling-stroke')
      //  .on('click',clicked);
      //  .text(function(d) { return d.properties.NAME_1; });;
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);
    //  .on('mouseover',hover);

    var endTime = new Date().getTime();
    console.log('drawing complete: ' + ((endTime - startTime) / 1000.0) + ' s elapsed');
  }
  // ---------------------------- END OF DRAW MAP FUNCTION -------------------------------------

  function setupToolTips() {
    var tip = d3.tip().attr('class', 'd3-tip')
      .html(function(d) {
        if (currentMap == 0)
          return d.properties["NAME_ISO"];
        else
          return d.properties["NAME_" + currentMap];
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

  MOD.visualize = function() {
    if (flowdata == null) {
      alert('No data available for visualizing. Please add a data file');
      return;
    }

    console.log("flowdata: " + flowdata.length);
    var baseTime = Date.parse(flowdata[0].timestamp); // timestamp of the first record
    var maxTime = Date.parse(flowdata[flowdata.length - 1].timestamp); // timestamp of the last record

    maxweight = getMaxWeight(); // retrieve the maximum weight in the network before using it
    var gradientUnitSize = maxweight / colourgradient.length; // divide the range of weights in to the number of colours in the gradient

    for (var i = 0; i < flowdata.length; i++) {
      var relativeTime = Date.parse(flowdata[i].timestamp) - baseTime;
      var src = getDatumByName(flowdata[i].source);
      var dest = getDatumByName(flowdata[i].destination);

      connectLocations(src, dest, relativeTime / (maxTime - baseTime) * 30000);
      if (flowdata[i].source_infected.toLowerCase() == 'true') {
        var colour = getColour(getWeight(flowdata[i].source, flowdata[i].destination), gradientUnitSize);
        console.log(colour);
        d3.select('[name=\"' + flowdata[i].source.toLowerCase() + '\"]')
          .transition()
          .duration(500)
          .delay(relativeTime / (maxTime - baseTime) * 30000)
          .ease('linear')
          .style('fill', colour);
        // console.log("inside infected: " + '[name=\"' + flowdata[i].source.toLowerCase() + '\"]');
      }

      if (flowdata[i].destination_infected.toLowerCase() == 'true') {
        d3.select('[name=\"' + flowdata[i].destination.toLowerCase() + '\"]')
          .transition()
          .duration(500)
          .delay(relativeTime / (maxTime - baseTime) * 30000)
          .ease('linear')
          .style('fill', basecolour);
      }
      // console.log(flowdata[i].source.toLowerCase() + ' ' + flowdata[i].destination.toLowerCase());
      console.log(flowdata[i].source + ' to ' + flowdata[i].destination + ': ' + getWeight(flowdata[i].source, flowdata[i].destination));
    }
  };

  function connectLocations(src, dest, delay) {
    var centroid1 = path.centroid(src);
    var centroid2 = path.centroid(dest);

    var connector = g.append('line')
      .style('stroke', 'blue')
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
        line.style('stroke', 'blue')
          .style('stroke-width', '3px');
      });

    // console.log(connector);
    var xdif = centroid2[0] - centroid1[0];
    var ydif = centroid2[1] - centroid1[1];
    var totalLength = Math.sqrt(xdif * xdif + ydif * ydif);
    // console.log('total line length: ' + totalLength);

    connector
      .attr('stroke-dasharray', 50 + ' ' + totalLength)
      .attr('stroke-dashoffset', (totalLength + 100))
      .transition()
      .duration(5000)
      .delay(delay)
      .attr('stroke-dashoffset', (totalLength + 100))
      .ease('linear')
      .attr('stroke-dashoffset', -totalLength);
    // .transition()
    // .attr('stroke-dashoffset', -totalLength);

    // svg.on("click", function(){
    //   path
    //     .transition()
    //     .duration(2000)
    //     .ease("linear")
    //     .attr("stroke-dashoffset", totalLength);
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
          console.log(networklayout);
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

  function getColour(weight, unit) {
    var index = parseInt(weight / unit);
    console.log('index: ' + index + ' ' + weight + ' ' + unit);
    if (index > (colourgradient.length - 1))
      index = colourgradient.length - 1;

    return colourgradient[index];
  }

  function getMaxWeight() {
    if (networklayout == null)
      return -1;

    var max = -1;

    for (var key in networklayout) {
      console.log(networklayout[key]);
      if (networklayout[key] > max)
        max = networklayout[key];
    }
    console.log('max: ' + max);
    return max;
  }

  return MOD;
}());
