var timestampToDate = function(ts){
    var date = new Date(parseInt(ts) * 1000);
    return date;
}

var sentimentTimestampToDate = function(sts){
    var date = timestampToDate(sts[0]);
    return [date, sts[1]];
};

var bucketSentimentArray = function(sentimentArray){
        
    var sentimentMap = sentimentArray
        .map(function(x){
            return [ parseInt(x[0]), x[1] ]; // parse floating point timestamp string to integer
        })
        .reduce(function(prev, curr) {
        if( curr[0] in prev ){
            prev[curr[0]].push(curr[1]);
        } else {
            prev[curr[0]] = [curr[1]];
        }
        return prev;
    }, {});

    var sentimentArray = [];
    for( key in sentimentMap ){
        var obj = sentimentMap[ key ];
        var avg = obj.reduce(function(a,b){ return a + b; }) / obj.length;
        sentimentArray.push( [key, avg] );
    }

    return sentimentArray;
};

var movingAverageSentimentArray = function(sentimentArray, lags){

    if(sentimentArray.length == 0){return sentimentArray;}

    var maSentimentArray = Array(sentimentArray.length);
    for (i = 0; i < sentimentArray.length; i += 1) {
        var iLag = i < lags ? 0 : i - lags + 1;
        var maSum = sentimentArray.slice(iLag, i+1).map(function(x){ return parseFloat(x[1]);}).reduce(function(a,b){ return a + b; });
        maSentimentArray[i] = [ sentimentArray[i][0], maSum / lags ];
    }
    return maSentimentArray;
};

var combineFilteredSentimentArrays = function(raw_data, hashtag_filters){
    
    var newArray = [].concat.apply(
        [],
        hashtag_filters
            .map(function(filter){
                if(filter in raw_data){
                    return raw_data[filter]["sentiment_series"];
                }
                return [];
            })
    );

    return newArray;
};

$( document ).ready(function() {
    console.log( "Page Ready!" );

    // GLOBAL VARIABLES!   
    var updateData; 
    var refreshLoop;
    var hashtagFilters;
    var backendHashtagFilters;
    var backendGeoFilters;

    var sentimentPlot = $('#sentimentSeriesContainer');

    var geoFilter = $('#geoFilter');
    geoFilter.locationpicker();

    var controlPanel = $("#controlPanel");
    var streamChoice = $("#streamChoice");
    var liveVisuals = $("#liveVisuals");

    var sampleButton = $("#sampleButton");
    var filterButton = $("#filterButton");
    var startFilterButton = $('#startFilterButton');
    var filterOptions = $('#filterOptions');

    var pauseButton = $("#pauseButton");
    var playButton = $("#playButton");
    var stopButton = $("#stopButton");


    // Initialize Sparklines
    var top10TagTableBody = $("#top10TagTableBody");
    for( i=0; i < 10; i+=1){
        var rowHTML = '<tr class="rank-' + i + '" style="display:none"></tr>';
        top10TagTableBody.append(rowHTML);
    }
    var top20TagTableBody = $("#top20TagTableBody");
    for( i=10; i < 20; i+=1){
        var rowHTML = '<tr class="rank-' + i + '" style="display:none"></tr>';
        top20TagTableBody.append(rowHTML);
    }
    top10TagTableBody.children("tr").append(
        '<td class="rank"><td class="tag"></td><td class="count"></td><td class="mean"></td><td class="last10"></td><td class="sparkline"><div class="sparklineContainer"></div></td>');
    top20TagTableBody.children("tr").append(
        '<td class="rank"><td class="tag"></td><td class="count"></td><td class="mean"></td><td class="last10"></td><td class="sparkline"><div class="sparklineContainer"></div></td>');
    $("#topTags").find("div.sparklineContainer").map(function(){
        $(this).highcharts('SparkLine', { series: [{}] });
    });

    // hashtag filters!
    var hashtagFilterInput = $('#hashtagFilterInput')
        .selectize({
            delimiter: ',',
            persist: true,
            create: function(input) {
                return {
                    value: input,
                    text: input
                }
            },
            onChange: function(value){
                hashtagFilters = value == "" ? null : value.split(",");
                updateData(false);
                // console.log(value);
                // console.log(hashtagFilters);
            }
        });

    // hashtag filters!
    var backendFilterInput = $('#backendFilterInput')
        .selectize({
            delimiter: ',',
            persist: true,
            create: function(input) {
                return {
                    value: input,
                    text: input
                }
            },
            onChange: function(value){
                backendHashtagFilters = value == "" ? null : value;
            }
        });

    $("#clearHashtagFilterInput").on("click", function(){
        hashtagFilterInput[0].selectize.clear();
    });

    // Charts!
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });

    // Create the chart
    sentimentPlot.highcharts('StockChart', {

        yAxis: {
            title: {text:"Sentiment Score"},
            min: -1,
            max: 1,
            tickInterval: .1,
            plotLines: [{
                color: '#FF0000',
                width: 2,
                value: 0,
                // dashStyle: 'longdash',
                animation: false
            }]
        },

        rangeSelector: {
            buttons: [
            {
                count: 1,
                type: 'minute',
                text: '1M'
            }, {
                count: 2,
                type: 'minute',
                text: '2M'
            }, {
                count: 5,
                type: 'minute',
                text: '5M'
            }, {
                type: 'all',
                text: 'All'
            }],
            inputEnabled: false,
            selected: 0
        },

        title : {
            text : 'Live Sentiment Data',
            style : {
                "font-size" : "20px"
            }
        },

        exporting: {
            enabled: false
        },

        series : [
            {
                name : 'Sentiment Score',
                lineWidth : 0,//0.25,
                marker : {
                    enabled : true,
                    radius : 2
                },
                animation: false,
                states: {
                    hover: false
                },
            },
            {
                name: 'Avg. Last 15',
                color: '#3300FF',
                animation: false,
                states: {
                    hover: false
                },
            }
        ],
        tooltip: {
            enabled: true,
            shared: true,
            valueDecimals: 3,
            animation: false,
            followPointer: false,
            followTouchMove: false

        }
    });
    
    var sentimentPlotSeries = sentimentPlot.highcharts().series;

    var rawData;
    var updateSentimentPlotSeries = function(){
        var sentimentSeriesRaw;
        if(hashtagFilters == null){
            sentimentSeriesRaw = rawData["GLOBAL_SENTIMENT"];
        } else{
            sentimentSeriesRaw = combineFilteredSentimentArrays(rawData, hashtagFilters);
        }

        var sentimentSeriesBuckets = bucketSentimentArray(sentimentSeriesRaw).map(function(x){
            return [ x[0]*1000, x[1] ];
        });
        var sentimentSeriesMABuckets = movingAverageSentimentArray(sentimentSeriesBuckets, 15);

        sentimentPlotSeries[0].setData(sentimentSeriesBuckets);
        sentimentPlotSeries[1].setData(sentimentSeriesMABuckets);

    };

    var updateSparklines = function(){
        var topTags = rawData["TOP_TAGS"].slice(0,20);
        topTags.map(function(tag,i){
            var row = $(".rank-"+i);
            row.css("display","table-row");
            row.find("td.rank").text(i+1);
            row.find("td.tag").html("<a href='https://twitter.com/hashtag/"+tag[0]+"' target='_blank'>"+tag[0]+"</a>");
            row.find("td.count").text(tag[1]);

            var newSer = bucketSentimentArray(rawData[tag[0]]["sentiment_series"]).map(function(x){
                return [ x[0]*1000, x[1] ];
            });

            row.find("td.mean").text( (newSer.map(function(x){ return parseFloat(x[1]); })
            .reduce(function(a,b){return a + b;}) / newSer.length)
            .toFixed(3));
            row.find("td.last10").text( (newSer.slice( newSer.length-10, newSer.length).map(function(x){ return parseFloat(x[1]); })
            .reduce(function(a,b){return a + b;}) / newSer.length)
            .toFixed(3));
            var chart = row.find("div.sparklineContainer").highcharts();
            // var now = (new Date()).getTime();
            chart.series[0].setData( newSer.slice( newSer.length-30, newSer.length) );
        });
        if(topTags.length < 20){
            d3.range( topTags.length, 20 ).map(function(i){
                var row = $(".rank-"+i);
                row.css("display","none");
                // row.css("visibility","hidden");
            })
        }
    };
    
    var updateData = function(getDataFromServer=true){

        if(getDataFromServer){
            $.post('/get-data', function(value) {
                rawData = JSON.parse(value);
            });
        }
        var topTags = rawData["TOP_TAGS"].slice(0,10);
        
        updateSentimentPlotSeries();  
        updateSparklines();
    };

    var launchVisuals = function(){
        refreshLoop = setInterval( updateData, 1000 );
        filterOptions.css('display','none');
        streamChoice.css("display","none");
        pauseButton.css("display","inline");
        playButton.css("display","none");
        controlPanel.css("display","inline");
        liveVisuals.css("display","inline");
    };


    filterButton.on('click', function(){
        filterOptions.css('display','inline');
    });

    startFilterButton.on('click', function(){
        filterOptions.css('display','none');

        var filterText = backendHashtagFilters == null ? "": "filters="+backendHashtagFilters;
        var getUrl = "/start-stream?" + filterText ;
        console.log(getUrl);

        $.get(getUrl, function(value, status){
            console.log("Starting stream: " + status );
        });

        launchVisuals();
    });

    // BUTTONS!
    pauseButton.on('click', function(){
        console.log("Pause plot updates");
        clearInterval(refreshLoop);
        playButton.css("display","inline");
        $(this).css("display","none");
    });

    playButton.on('click', function(){
        console.log("Resume plot updates");
        refreshLoop = setInterval( updateData, 1000 );
        pauseButton.css("display","inline");
        $(this).css("display","none");
    });

    stopButton.on('click', function(){
        clearInterval(refreshLoop);
        $.post("/stop-stream",function(value, status){
            console.log("Stopping stream: " + status );
        });
        controlPanel.css("display","none");
        liveVisuals.css("display","none");
        streamChoice.css("display","inline");
    });

    // Methods to start stream 
    sampleButton.on("click", function(){
        $.get("/start-stream", function(value, status){
            console.log("Starting stream: " + status );
        });
        launchVisuals();
    });

    // Methods to start stream 


    // filterButton.on("click", function(){
    //     console.log('clicked filter button');

    //     $.post("/start-stream", function(value, status){
    //         console.log("Starting stream: " + status );
    //     });
    //     launchVisuals();
    // });
    

});