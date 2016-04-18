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

    var refreshLoop;
    var sentimentPlot = $('#stockChartContainer');

    $("#stopButton").on('click', function(){
        $(this).css("display","none");
        clearInterval(refreshLoop);
        $.post("/stop-stream",function(value){
            console.log(JSON.parse(value));
        });
        $("#streamChoice").css("display","block");
    });

    // Methods to start stream 
    $("#sampleButton").on("click", function(_){
        console.log("clicked sampleButton");
        $.post("/start-stream", function(value){
            console.log("Start stream: " + JSON.parse(value) );
        });
        $("#streamChoice").css("display","none");
        $("#stopButton").css("display","block");
        $("#streamOutput").css("display","block");
        $("#stockChartContainer").css("display","block");

        // Chart!
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
                text : 'Live Sentiment Data'
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

        // set up the updating of the chart each second
        var sentimentPlotSeries = sentimentPlot.highcharts().series;
        console.log(sentimentPlotSeries);

        // Load/Refresh/Render stream data
        refreshLoop = setInterval(function () {
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
                // console.log(buckets);
                // console.log(maBuckets);

            });

        }, 1000);

        
    });

});