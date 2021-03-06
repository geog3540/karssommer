var polygonJSONFile = 'data/RoadInfo.geojson'
// change the projection if needed *d3.geoAlbers()*
var projection = d3.geoAlbers();
// Relative placement of legend that ranges between 0 and 1.
// 0 is the start, whereas 1 i the end of each panel.
// If you want to put the legend on the left, then use 0.
// legendY = 0.5 puts the legend in the middle of the Y Axis.
var legendX = 0.1, legendY = 0.7

// id attribute and the name attribute to be used in the tooltip
var idAttribute = 'FIPS', nameAttribute = 'County';

// Find the abbreviations of color names from https://colorbrewer2.org/
var colors =  colorbrewer.RdPu;

// Chart/map attributes (variables) and formats based on the divs defined above
// For attribute 1 (the same for all others), see the description of the parameters below.
// att1: the actual name of the attribute on the file
// att1: the alias that you would like to use. This could be anything you can type.
// att1format: enter the d3.format string to display the variables in the format you like
// Check this link on how to specify the desired format:
// https://observablehq.com/@d3/d3-format
var att1 = d3.select('#classDropdown').node().value;
var att1alias = d3.select('#classDropdown').node().value;
var att1format = '.2%';

var charts = [
    {'map': '#myMap', 'hist': '#divHist1', 'form': att1format,
    'var': att1, 'ax': att1alias}
];

 var attributesToBeNormalized = [];
 var multiplyBy = [];
 var divideBy = [];

//Get the selected name of the dropdown
var suffix = d3.select('#classDropdown').node().value;

var numClasses = 5;
var color_scale = colors[numClasses];

// Height, width, margins
var widthheightRatio = 0.4;
var chartWidth = d3.select('#myMap').node().getBoundingClientRect().width;
var chartHeight = chartWidth * widthheightRatio;
var margin = {top: 10, right: 20, bottom: 10, left:20};
var width = chartWidth - margin.right - margin.left;
var height = chartHeight - margin.top - margin.bottom;
var histHeight = (chartHeight * .25);


// Save scales as global scale variables
//TODO: fix the classifications
var linear_scale = d3.scaleLinear().range(color_scale);
var jenks_scale = d3.scaleThreshold().range(color_scale);
var equal_interval_scale = d3.scaleQuantize().range(color_scale);	// interval
var hist_scale = d3.scaleLinear().range([0, width]); // hist X
var hist_y = d3.scaleLinear().range([histHeight, 0]);	// hist Y


current_scale = jenks_scale;	// Save scales as global scale variable


var buttons = [
    {'btn': '#buttonLength'},
    {'btn': '#buttonVehicleMiles'}
];
activeButton = 'buttonLength';

var bins = d3.histogram()
.domain(hist_scale.domain())
.thresholds(10);

// Functions for the chart
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
}
d3.selection.prototype.moveToBack = function() {
    return this.each(function(){
        this.parentNode.appendChild(this).style('z-index', 1);
    });
}

// Set up the legend dimensions and style
var holdLegend = d3.legendColor()
.shapeWidth(15)
.shapeHeight(5)
.shapePadding(10)
.orient('vertical')
.labelFormat(d3.format(att1format))
.useClass(false)
.scale(current_scale);

var polygons;
var proj;
    //this is where you read the json polygon data
d3.json(polygonJSONFile).then(function(data) {
        // set up the projection
        polygons = data;
        proj = d3.geoPath().pointRadius(2);
        // TODO: change the projection details here below - including specific parameters such as rotation, extent, etc.
        proj.projection(projection.fitSize([width, height], polygons));

        ////////////////////////////////////////////////////
        // Normalize based multiplyby and divideby values
        polygons.features.forEach(function(c) {
            attributesToBeNormalized.forEach(function(d, i) {
                c.properties[d] = recalculateAttribute(c.properties[d], multiplyBy[i], c.properties[divideBy[i]]);
            });
        });

        // Set the buttons up for interactivity
        buttons.forEach(function(d) {
            d3.select(d.btn).on('click', function() {
                d3.select('#buttonLength').classed('active', false);
                d3.select('#buttonVehicleMiles').classed('active', false);
                //d3.selectAll('.btn').classed('active', false);
                d3.select(this).classed('active', true);
                var buttonid = d3.select(this).node().id;
                activeButton = buttonid;

                if(document.getElementById("myCheck").checked) {
                    if(buttonid == "buttonLength"){
                        $(".container").fadeOut(200);
                        functionAlert("These charts will summarize roads by the percent of total length in each county");
                    } else if(buttonid == "buttonVehicleMiles"){
                        $(".container").fadeOut(200);
                        functionAlert("These charts will summarize roads by percent of total miles driven by vehicles for each county. Roads with more traffic will have higher weight, and low traffic roads will have less weight");
                    }
                }

                if(activeButton == 'buttonLength') {
                    charts[0].var = d3.select('#classDropdown').node().value;
                    charts[0].ax = d3.select('#classDropdown').node().value;
                } else if(activeButton == 'buttonVehicleMiles') {
                    charts[0].var = 'vm' + d3.select('#classDropdown').node().value;
                    charts[0].ax = d3.select('#classDropdown').node().value;
                } else {
                    err.message;
                }

                rescale(polygons);
                updateHistogram(polygons);
            });
        });

        d3.select('#classDropdown').on('input', function() {
            if(activeButton == 'buttonLength') {
                charts[0].var = d3.select('#classDropdown').node().value;
                charts[0].ax = d3.select('#classDropdown').node().value;
            } else if(activeButton == 'buttonVehicleMiles') {
                charts[0].var = 'vm' + d3.select('#classDropdown').node().value;
                charts[0].ax = d3.select('#classDropdown').node().value;
            } else {
                err.message;
            }

            rescale(polygons);
            updateHistogram(polygons);
        });

        updateHistogram(polygons)

        // For each input attribute make a map and a histogram
        updateMap(polygons)

});

function updateHistogram(polygons) {
    charts.forEach(function(d) {
            var dependent = d.var;

            var hist_var = polygons.features.filter(function(e) { return +e.properties[dependent]; })
            .map(function(e) { return +e.properties[dependent]; });
            setScales(hist_var);

            // set histogram
            var currentBins = bins.domain(linear_scale.domain())(hist_var);
            var y = hist_y.domain([0, d3.max(currentBins, function(e) { return e.length; })]);

            d3.select("#histogramSVG").remove();

            // Draw histogram
            var hist = d3.select(d.hist).append("svg")
            .attr("id","histogramSVG")
            .attr("width", width + margin.left + margin.right)
            .attr("height", histHeight + margin.top + margin.bottom + 30)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
            var bar = hist.selectAll('.bar')
            .data(currentBins)
            .enter().append('g')
            .attr("transform", function(e) {
                return "translate(" + hist_scale(e.x0) + "," + y(e.length) + ")";
            });

            // hist bars
            bar.append("rect")
            .attr('class', 'bar')
            .attr("x", 1)
            .attr("width", function(e) { return hist_scale(e.x1) - hist_scale(e.x0); })
            .attr("height", function(e) { return histHeight - y(e.length); })
            .style('fill', function(e) { return current_scale(fillHist(e, d.var)); });

            // Hist axes
            hist.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + histHeight + ")")
            .call(d3.axisBottom(hist_scale)
            .ticks(6)
            .tickFormat(function(e) {
                    //console.log(e*100)
                    return Math.trunc(e*10000)/100 + '%';
            }));

            // hist axis label
            hist.append('text')
            .attr('transform', 'translate(' + (width/2) + ',' +
            (histHeight + 35) + ')')
            .style('font-family', 'sans-serif')
            .style('text-anchor', 'middle')
            .text(d.ax);
    });
}

function updateMap(polygons) {
        charts.forEach(function(d) {
            // Set scales + variable for each map
            d3.select("#panelSVG").remove();

            var dependent = d.var;

            // tooltip for maps
            var tooltipD3 = d3.select(d.map)
            .append("div")
            .attr("class", "tooltipD3")
            .attr("id", function() { return d.map.substr(1) + '-tooltip'; })
            .style('display', 'none');

            // Set up the panel that includes the map and the legend
            var panel = d3.select(d.map).append("svg")
            .attr("id","panelSVG")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // append the choropleth map
            var map = panel.selectAll('.path')
            .data(polygons.features)
            .enter().append('g');
            map.append('path')
            .attr("class", function(e) { return classPolygon(e, d.map); })
            .on('mouseover', function(e) { return mouseOver(e, dependent); })
            .on('mouseout', mouseOut)
            .on('mousemove', mousemoveFunc)
            .attr("d", proj)
            .style('fill', function(c) {
                return current_scale(+c.properties[d.var]);
            });

            holdLegend.labelFormat(d.form);
            // add the legend
            panel.append('g')
            .attr("class", "legendQuant")
            .attr("transform", "translate(" + (width * legendX) + "," + (height * legendY) + ")");
            panel.select('.legendQuant').call(holdLegend.scale(current_scale));
        })
}

window.addEventListener("resize", displayWindowSize);
function displayWindowSize() {
    chartWidth = d3.select('#myMap').node().getBoundingClientRect().width;
    chartHeight = chartWidth * widthheightRatio;
    margin = {top: 10, right: 20, bottom: 10, left:20};
    width = chartWidth - margin.right - margin.left;
    console.log('w: ' + width)
    console.log('cw: ' + chartWidth)
    height = chartHeight - margin.top - margin.bottom;
    console.log('h: ' + height)
    console.log('ch: ' + chartHeight)
    histHeight = (chartHeight * .25);

    hist_scale = d3.scaleLinear().range([0, width]); // hist X
    hist_y = d3.scaleLinear().range([histHeight, 0]);	// hist Y
    bins = d3.histogram()
    .domain(hist_scale.domain())
    .thresholds(10);

    updateHistogram(polygons);

    proj.projection(projection.fitSize([width, height], polygons));

    updateMap(polygons);
}

function recalculateAttribute(attribute, multiplyby, divideby) {
    if (!+divideby) {
        return null;
    } else {
        return ((+multiplyby) * (+attribute)) / +divideby;
    }
}

function classPolygon(polygon, map) {
    // Function to create the correct CSS style name for each polygon.
    // (e.g. Johnson county polygon, FIPS 19) >> 'polygons.lung.polygon19'
    return 'polygons ' + map + ' polygon' + polygon.properties[idAttribute];
}

function getBoundingBoxCenter (selection) {
    // get the DOM element from a D3 selection
    var element = selection.node();
    // use the native SVG interface to get the bounding box
    var bbox = element.getBBox();
    // return the center of the bounding box
    return [bbox.x + bbox.width/2, bbox.y + bbox.height/2];
}

function mouseOver(polygon, attr) {
    /* Mouse over routine
    Highlight the polygon on all maps, adjust the tooltip */
    //enter the id of the polygon
    var id = polygon.properties[idAttribute],
    //enter the name of the polygon
    name = polygon.properties[nameAttribute];

    return charts.forEach(function(d) {

        var map = d3.select(d.map);
        var tip = d.map + '-tooltip';
        // select the polygon by its id attribute
        map.select('.polygon'+id)
        .moveToFront()
        .style('stroke', 'black')
        .style('opacity', '1');

        // map tooltip
        if(activeButton == 'buttonLength') {
            d3.select(tip)
            .style('display', null)
            .html("<p><b>" + name + " " + nameAttribute + "</b><br/>" + d.var +
            ": " + d3.format(d.form)(polygon.properties[d.var]) + "</p>");
        } else if(activeButton == 'buttonVehicleMiles') {
            d3.select(tip)
            .style('display', null)
            .html("<p><b>" + name + " " + nameAttribute + "</b><br/>" + d.ax +
            ": " + d3.format(d.form)(polygon.properties[d.var]) + "</p>");
        }
    });
}

function mousemoveFunc(polygon) {
    /* Moves tooltip */
    //the id of the polygon
    var id  = '.polygon' + polygon.properties[idAttribute];

    charts.forEach(function(d) {
        var map = d3.select(d.map);
        var polygonOnMap = getBoundingBoxCenter(map.select(id));
        var tip = d.map + '-tooltip';

        var offsetY = d3.select('#myMap').node().getBoundingClientRect().y
        var offsetX = d3.select('#myMap').node().getBoundingClientRect().x

        d3.select(tip)
        .style("top", (polygonOnMap[1] + offsetY + window.pageYOffset - 40) + "px" )
        .style("left", (polygonOnMap[0] + offsetX + window.pageXOffset + 30) + "px");
    });
}

// Resets the polygon after mouseout
function mouseOut(polygon) {

    var id = polygon.properties[idAttribute],
    name = polygon.properties[nameAttribute];

    charts.forEach(function(d) {

        var map = d3.select(d.map);
        var tip = d.map + '-tooltip';

        map.select(('.polygon'+id))
        .style('stroke', "#dadada")
        .style('opacity', '0.85');
        // map tooltip
        d3.select(tip)
        .style('display', "none");
    });
}

// Function to set scales depending on the attribute
function setScales(data) {

    //grab the number of classes from the dropdown list
    //var numClasses = d3.select('#classDropdown').node().value;
    //color_scale = colors[numClasses];

    //current_scale.range(color_scale);
    var max = d3.max(data), min = d3.min(data);

    /*quantile_scale
    .domain(data)
    .range(color_scale);*/

    equal_interval_scale
    .domain([min, max])
    .range(color_scale);

    var naturalbreaks = ss.ckmeans(data, color_scale.length).map(v => v.pop())
    jenks_scale.domain(naturalbreaks).range(color_scale);
    linear_scale.domain([min, max]).range(color_scale);
    hist_scale.domain([min, max]);			// set the histogram up dynamically
}

function fillHist(bar, attr) {
    // Function to return the average value for a given bar
    var mean = d3.mean(bar, function(d) { return +d; });
    var med = d3.mean(bar, function(d) { return +d; });
    return med;
}

function rescale(data) {
    // function to restyle all of the maps

    charts.forEach(function(d) {
        var hist_var = data.features.filter(function(e) { return +e.properties[d.var]; })
        .map(function(e) { return +e.properties[d.var]; });

        // Set scale for each chart (diff vars)
        setScales(hist_var);
        // map polygons
        var map = d3.select(d.map).selectAll('.polygons')
        .transition(250)
        .style('fill', function(e) { return current_scale(+e.properties[d.var]); });
        // histogram
        var hist = d3.select(d.hist).selectAll('.bar')
        .transition(250)
        .style('fill', function(e) { return current_scale(fillHist(e, d.var));
        });

        holdLegend = d3.legendColor()
        .shapeWidth(15)
        .shapeHeight(5)
        .shapePadding(10)
        .orient('vertical')
        .labelFormat(d3.format(d.form))
        .useClass(false)
        .scale(current_scale);

        d3.select(d.map).select('.legendQuant').call(holdLegend.scale(current_scale));
    });
} // end rescale, apply to buttons

function functionAlert(msg, myYes) {
    var confirmBox = $("#confirm");
    confirmBox.find(".message").text(msg);
    confirmBox.find(".yes").unbind().click(function() {
        confirmBox.hide();
         $(".container").fadeTo(200,1);
    });
    confirmBox.find(".yes").click(myYes);
    confirmBox.show();
}