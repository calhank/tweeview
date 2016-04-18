var timestampToDate = function(ts){
    var date = new Date(parseInt(ts) * 1000);
    return date;
}

var sentimentTimestampToDate = function(sts){
    var date = timestampToDate(sts[0]);
    return [date, sts[1]];
};

var bucketSentimentArray = function(mike_sweeney){
        
    var sentimentMap = mike_sweeney
        .map(function(x){
            return [ parseInt(x[0]), x[1] ];
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

$( document ).ready(function() {
        console.log( "Page Ready!" );

    var refreshLoop;
    var sentimentPlot = $('#stockChartContainer');

    $("#stopButton").on('click', function(){
        $(this).css("display","none");
        clearInterval(refreshLoop);
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
                    value: 0
                }]
            },

            rangeSelector: {
                buttons: [
                {
                    count: 30,
                    type: 'second',
                    text: '30S'
                }, {
                    count: 1,
                    type: 'minute',
                    text: '1M'
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

            series : [{
                name : 'Sentiment Score',
                tooltip: {
                    valueDecimals: 3,
                }
            }],
        });

        // set up the updating of the chart each second
        var sentimentPlotSeries = sentimentPlot.highcharts().series[0];

        // Load/Refresh/Render stream data
        refreshLoop = setInterval(function () {
            $.post('/get-data', function(value) {
                var raw_data = JSON.parse(value);
                var globalSentiment = raw_data[0];
                var final = globalSentiment.map(sentimentTimestampToDate);

                var buckets = bucketSentimentArray(globalSentiment).map(function(x){
                    return [ x[0]*1000, x[1] ];
                });


                sentimentPlotSeries.setData(buckets);
            });

        }, 1000);

        
    });

});