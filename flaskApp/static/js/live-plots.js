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
        obj = sentimentMap[ key ];
        avg = obj.reduce(function(a,b){ return a + b; }) / obj.length;
        sentimentArray.push( [key, avg] );
    }

    return sentimentArray;
};

var movingAverageSentimentArray = function(sentimentArray, lags){

    if(sentimentArray.length == 0){return sentimentArray;}

    maSentimentArray = Array(sentimentArray.length);
    for (i = 0; i < sentimentArray.length; i += 1) {
        iLag = i < lags ? 0 : i - lags + 1;
        maSum = sentimentArray.slice(iLag, i+1).map(function(x){ return parseFloat(x[1]);}).reduce(function(a,b){ return a + b; });
        maSentimentArray[i] = [ sentimentArray[i][0], maSum / lags ];
    }
    return maSentimentArray;
};

$( document ).ready(function() {
    console.log( "Page Ready!" );

    // GLOBAL VARIABLES!    
    var refreshLoop;
    var hashtagFilters;

    var sentimentPlot = $('#sentimentSeriesContainer');

    var controlPanel = $("#controlPanel");
    var streamChoice = $("#streamChoice");
    var liveVisuals = $("#liveVisuals");

    var sampleButton = $("#sampleButton");
    var filterButton = $("#filterButton");
    var pauseButton = $("#pauseButton");
    var playButton = $("#playButton");
    var stopButton = $("#stopButton");

    // hashtag filters!
    var hashtagFilterInput = $('#hashtagFilterInput')
        .selectize({
            delimiter: ',',
            persist: false,
            create: function(input) {
                return {
                    value: input,
                    text: input
                }
            },
            onChange: function(value){
                hashtagFilters = value == "" ? null : value.split(",");
                // console.log(value);
                console.log(hashtagFilters);
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
            min: -1,
            max: 1,
            tickInterval: .1,
            plotLines: [{
                color: '#FF0000',
                width: 2,
                value: 0,
                dashStyle: 'longdash'
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
                lineWidth : 0,
                    marker : {
                        enabled : true,
                        radius : 2
                    },
            },
            {
                name: 'Avg. Last 15',
                color: '#3300FF',
            }
        ],
        tooltip: {
            valueDecimals: 3,
        }
    });
    
    var sentimentPlotSeries = sentimentPlot.highcharts().series;

    var updateData = function(){
        $.post('/get-data', function(value) {
            var raw_data = JSON.parse(value);
            console.log(raw_data["TOTAL_TWEET_COUNT"]);
            var globalSentiment = raw_data["GLOBAL_SENTIMENT"];
            var final = globalSentiment.map(sentimentTimestampToDate);

            var buckets = bucketSentimentArray(globalSentiment).map(function(x){
                return [ x[0]*1000, x[1] ];
            });
            var maBuckets = movingAverageSentimentArray(buckets, 15);

            sentimentPlotSeries[0].setData(buckets);
            sentimentPlotSeries[1].setData(maBuckets);
        });
    };

    var launchVisuals = function(){
        refreshLoop = setInterval( updateData, 1000 );
        streamChoice.css("display","none");
        pauseButton.css("display","inline");
        playButton.css("display","none");
        controlPanel.css("display","inline");
        liveVisuals.css("display","inline");
    };

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
        $.post("/start-stream", function(value, status){
            console.log("Starting stream: " + status );
        });
        launchVisuals();
    });

    // Methods to start stream 


    filterButton.on("click", function(){
        console.log('clicked filter button');

        $.post("/start-stream", function(value, status){
            console.log("Starting stream: " + status );
        });
        launchVisuals();
    });
    

});