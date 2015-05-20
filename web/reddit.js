//# dc.js Getting Started and How-To Guide



var yearlyBubbleChart = dc.bubbleChart('#yearly-bubble-chart');
var fluctuationChart = dc.barChart('#fluctuation-chart');
var moveChart = dc.lineChart('#monthly-move-chart');
var dayOfWeekChart = dc.rowChart('#day-of-week-chart');
var topicNameChart = dc.rowChart('#topic-name-chart');
var over18Chart = dc.rowChart('#over18-chart');

d3.csv('data/askgaybros_web_with_features_subset.csv', function (data) {
    console.log('loaded')
    /* since its a csv file we need to format the data a bit */
    var dateFormat = d3.time.format('%m/%d/%Y');
    var numberFormat = d3.format('.2f');
    var topic_color_scale = d3.scale.category10()

    data.forEach(function (d) {
        d.dd = dateFormat.parse(d.date);
        d['number of words'] = +d['number of words'];
        d['num_words'] = +d['number of words'];
        d.ups = +d['up votes'];
        d.score = +d.score;
        d['number of comments'] = +d['number of comments'];
        d['num_comments'] = +d['number of comments'];
    });

    //### Create Crossfilter Dimensions and Groups
    //See the [crossfilter API](https://github.com/square/crossfilter/wiki/API-Reference) for reference.
    var ndx = crossfilter(data);

    var localQ = 'topic name';
    var localDim = ndx.dimension( function(d)  {
        return d[localQ]
        }
    )
    ;

    var localFilter = localDim.group().reduce(
        /* callback for when data is added to the current filter results */
        function (p, v) {
            ++p.count;

            p.sum_ups += v.ups;
            p.sum_num_words += v.num_words;

            p.avg_ups = p.sum_ups / p.count;
            p.avg_num_words = p.sum_num_words / p.count;

            return p;
        },
        /* callback for when data is removed from the current filter results */
        function (p, v) {
            --p.count;

            p.sum_ups -= v.ups;
            p.sum_num_words -= v.num_words;

            p.avg_ups = p.sum_ups / p.count;
            p.avg_num_words = p.sum_num_words / p.count;

            return p;
        },
        /* initialize p */
        function () {
            return {
                count: 0,
                sum_ups:0,
                sum_num_words: 0,
                avg_ups:0,
                avg_num_words:0
            };
        }
    );


    yearlyBubbleChart
        .width($("#yearly-bubble-chart").parent().width()) // (optional) define chart width, :default = 200
        .height($("#yearly-bubble-chart").parent().width() *.25)  // (optional) define chart height, :default = 200
        .dimension(localDim)
        .group(localFilter)
        .colors(topic_color_scale)
        //.colorDomain([-500, 500])
        .x(d3.scale.linear().domain([50,400]))
        //.y(d3.scale.linear().domain([5,6]))
        .r(d3.scale.linear().domain([0,300]))
        .colorAccessor(function(d){
            return d.key;
        })
        .keyAccessor(function (p){

            return p.value.avg_num_words;
        })
        .valueAccessor(function (p){

            return p.value.avg_ups;
        })
        .radiusValueAccessor(function (p) {
            return Math.sqrt(p.value.count);
        })
        .elasticY(true)
        .elasticX(true)
        .yAxisPadding(10)
        .xAxisPadding(20)
        .renderHorizontalGridLines(true) // (optional) render horizontal grid lines, :default=false
        .renderVerticalGridLines(true) // (optional) render vertical grid lines, :default=false
        .xAxisLabel('Avg. No. of Words') // (optional) render an axis label below the x axis
        .yAxisLabel('Avg. No. of Up Votes') // (optional) render a vertical axis lable left of the y axis
        .renderLabel(true)
        .label(function (p) {
            return p.key;
        })
        .renderTitle(true)
        .title(function (p) {
            return [
                'topic: ' + p.key,
                'number of posts: ' + numberFormat(p.value.count),
                'avg. no. words: ' + numberFormat(p.value.avg_num_words),
                'avg. no. up votes: ' + numberFormat(p.value.avg_ups)

            ].join('\n');
        })
        ;

    var fluctuation = ndx.dimension(function (d) {
        return Math.round(d.num_words/25) * 25;
    });

    var fluctuationGroup = fluctuation.group();


    fluctuationChart
        .width($("#fluctuation-chart").parent().width()) // (optional) define chart width, :default = 200
        .height($("#fluctuation-chart").parent().width() *.85)  // (optional) define chart height, :default = 200
        .dimension(fluctuation)
        .group(fluctuationGroup)
        .margins({top: 10, right: 50, bottom: 30, left: 40})
        .x(d3.scale.linear().domain([0, 1800]))//This doesn't matter, because of elasticX
        .elasticY(true)
        .elasticX(true)
        .alwaysUseRounding(true)
        .round(dc.round.floor)
        .renderHorizontalGridLines(true)
        .xAxisLabel('Number of words') // (optional) render an axis label below the x axis
        .yAxisLabel('Number of posts') // (optional) render an axis label below the y axis
        ;

    var moveMonths = ndx.dimension(function (d) {

        return d.dd;
    });


    var indexAvgByMonthGroup = moveMonths.group().reduceCount()

    moveChart
        .renderArea(true)
        .width($("#monthly-move-chart").parent().width()) // (optional) define chart width, :default = 200
        .height($("#monthly-move-chart").parent().width() *.40)  // (optional) define chart height, :default = 200
        .margins({top: 30, right: 50, bottom: 25, left: 40})
        .dimension(moveMonths)
        .mouseZoomable(false)
        .brushOn(true)
        .x(d3.time.scale().domain([new Date(14, 3, 15), new Date(15, 3, 31)]))
        .xAxisLabel('Date') // (optional) render an axis label below the x axis
        .yAxisLabel('Number of posts') // (optional) render an axis label below the y axis
        .group(indexAvgByMonthGroup)
        .elasticX(true)
        .elasticY(true)
        .valueAccessor(function (d){
            return d.value;
        })
        ;

    //moveChart.xAxis().tickFormat(
    //    function (v){
    //        return dateFormat(v);
    //    }
    //)
    //;

    var dayOfWeek = ndx.dimension(function (d) {
        var day = d.dd.getDay();
        var name = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return day + '.' + name[day];
    });
    var dayOfWeekGroup = dayOfWeek.group();


    dayOfWeekChart
        .width($("#day-of-week-chart").parent().width())
        .height($("#day-of-week-chart").parent().width() *1)
        .margins({top: 20, left: 10, right: 10, bottom: 20})
        .group(dayOfWeekGroup)
        .dimension(dayOfWeek)
        // assign colors to each value in the x scale domain
        //.ordinalColors(['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#dadaeb'])
        .label(function (d) {
            return d.key.split('.')[1];
        })
        // title sets the row text
        .title(function (d) {
            return d.value;
        })
        .elasticX(true)
        .xAxis().ticks(4);

    var topicDim = ndx.dimension(function (d) {
        return d['topic name'];
    });
    var topicGroup = topicDim.group();


    topicNameChart.width($("#topic-name-chart").parent().width())
        .height($("#topic-name-chart").parent().width() *1)
        .margins({top: 20, left: 10, right: 10, bottom: 20})
        .group(topicGroup)
        .dimension(topicDim)
        .colors(topic_color_scale)
        // assign colors to each value in the x scale domain
        //.ordinalColors(['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#dadaeb'])
        .label(function (d) {

            return d.key;
        })
        // title sets the row text
        .title(function (d) {
            return d.value;
        })
        .elasticX(true)
        .xAxis().ticks(4);

    var over18Dim = ndx.dimension(function (d) {
        return d['over 18'];
    });
    var over18Group = over18Dim.group();


    over18Chart.width($("#over18-chart").parent().width())
        .height($("#over18-chart").parent().width() *1)
        .margins({top: 20, left: 10, right: 10, bottom: 20})
        .group(over18Group)
        .dimension(over18Dim)
        //.colors(d3.scale.category20b())
        // assign colors to each value in the x scale domain
        //.ordinalColors([ '#c6dbef', '#dadaeb'])
        .label(function (d) {

            return d.key;
        })
        // title sets the row text
        .title(function (d) {
            return d.value;
        })
        .elasticX(true)
        .xAxis().ticks(4);


    dc.renderAll();
});

d3.csv('data/askgaybros_web_with_features_subset.csv', function (data) {
    console.log('loaded')
    /* since its a csv file we need to format the data a bit */
    var dateFormat = d3.time.format('%m/%d/%Y');

    data.forEach(function (d) {
        d.dd = dateFormat.parse(d.date);
        d['number of words'] = +d['number of words'];
        d.ups = +d.ups;
        d['number of comments'] = +d['number of comments'];

        d.score = null;
        d['topic name'] = null;
        d['over 18'] = null;
    });
    var width = $("#scatter").parent().width()
            size = ($("#yearly-bubble-chart").parent().width() - 50*2) / 3,
            padding = 50;

    var x = d3.scale.linear()
            .range([padding *1 , size - padding *1]);

    var y = d3.scale.linear()
            .range([size - padding * 1, padding * 1]);

    var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .ticks(3);

    var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(3);

    var color = d3.scale.category10();

    var domainByTrait = {},
            //traits = d3.keys(data[0]).filter(function(d) { return d !== "topic_name"; }),
            traits = ["number of words", "up votes", "number of comments"],
            n = traits.length;

    traits.forEach(function(trait) {
        domainByTrait[trait] = d3.extent(data, function(d) { return d[trait]; });
    });

    xAxis.tickSize(size * n);
    yAxis.tickSize(-size * n);

    var svg = d3.select("#scatter").append("svg")
            .attr("width", size * n + padding)
            .attr("height", size * n + padding)
            .append("g")
            .attr("transform", "translate(" + padding + "," + padding / 2 + ")");

    svg.selectAll(".x.axis")
            .data(traits)
            .enter().append("g")
            .attr("class", "x axis")
            .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
            .each(function(d) { x.domain(domainByTrait[d]); d3.select(this).call(xAxis); });

    svg.selectAll(".y.axis")
            .data(traits)
            .enter().append("g")
            .attr("class", "y axis")
            .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
            .each(function(d) { y.domain(domainByTrait[d]); d3.select(this).call(yAxis); });

    var cell = svg.selectAll(".cell")
            .data(cross(traits, traits))
            .enter().append("g")
            .attr("class", "cell")
            .attr("transform", function(d) { return "translate(" + (n - d.i - 1) * size + "," + d.j * size + ")"; })
            .each(plot);

    // Titles for the diagonal.
    cell.filter(function(d) { return d.i === d.j; }).append("text")
            .attr("x", padding)
            .attr("y", padding)
            .attr("dy", ".71em")
            .text(function(d) { return d.x; });

    function plot(p) {
        var cell = d3.select(this);

        x.domain([domainByTrait[p.x][0] *.8,domainByTrait[p.x][1] *2.5]);
        y.domain([domainByTrait[p.y][0] *.8,domainByTrait[p.y][1] *2.5]);

        cell.append("rect")
                .attr("class", "frame")
                .attr("x", padding / 2)
                .attr("y", padding / 2)
                .attr("width", size - padding)
                .attr("height", size - padding);

        cell.selectAll("circle")
                .data(data)
                .enter().append("circle")
                .attr("cx", function(d) { return x(d[p.x]); })
                .attr("cy", function(d) { return y(d[p.y]); })
                .attr("r", 3)
                .style("fill", function(d) { return "steelblue"; })
                .attr("opacity", ".10");;
    }

    function cross(a, b) {
        var c = [], n = a.length, m = b.length, i, j;
        for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
        return c;
    }


});
