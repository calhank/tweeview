var timestampToDate = function(ts){
    var date = new Date(parseInt(ts) * 1000);
    return date;
}

var sentimentTimestampToDate = function(sts){
    var date = timestampToDate(sts[0]);
    return [date, sts[1]];
};

var geoPointRadiusToBox = function(location, radius){
    // code adapted from http://gis.stackexchange.com/questions/2951/algorithm-for-offsetting-a-latitude-longitude-by-some-amount-of-meters

     //Earth’s radius, sphere
     var R = 6378137

     //Coordinate offsets in radians
     var dLat = radius/R
     var dLon = radius/(R*Math.cos(location.latitude/180))

     //OffsetPosition, decimal degrees
     var latO = (location.latitude - dLat * 180/Math.PI).toFixed(1)
     var lonO = (location.longitude - dLon * 180/Math.PI ).toFixed(1)

     var lat1 = (location.latitude + dLat * 180/Math.PI).toFixed(1)
     var lon1 = (location.longitude + dLon * 180/Math.PI ).toFixed(1)

    return  lonO + "," + latO + "," + lon1 + "," + lat1;
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
        Object.keys(raw_data)
            .filter(function(x){
                // check if lower case transformation of key is in the list of hashtag filters, also lowercase transformed
                var result = hashtag_filters
                    .map(function(x){
                        return x.toLowerCase(); 
                    })
                    .indexOf(x.toLowerCase()) == -1 ? false : true;
                return result;
        })
        .map(function(x){
            // take filtered keys and get series from raw data
            return raw_data[x]["sentiment_series"];
        })
    );
    // console.log(newArray);
    return newArray;
};

var combineTopRelatedElementCounts = function(target, raw_data, hashtag_filters){

        var newMap = [].concat.apply(
            [],
            Object.keys(raw_data)
                .filter(function(x){
                    // check if lower case transformation of key is in the list of hashtag filters, also lowercase transformed
                    var result = hashtag_filters
                        .map(function(x){
                            return x.toLowerCase(); 
                        })
                        .indexOf(x.toLowerCase()) == -1 ? false : true;
                    return result;
            })
            .map(function(x){
                // take filtered keys and get target metric from raw data
                return raw_data[x][target];
            })
        )
        .reduce(function(prev, curr) {
            if( curr[0] in prev ){
                prev[curr[0]] += curr[1];
            } else {
                prev[curr[0]] = curr[1];
            }
            return prev;
        }, {});

    return newMap;
};

var prepForTopRelated = function(relMap){

    // console.log(relMap);    
    var newArray = [];
    for( key in relMap ){
        var val = relMap[ key ];
        newArray.push( [key, val] );
    }
    return newArray;
};

var prepForWordCloud = function(wordMap){
        
    var newArray = [];
    for( key in wordMap ){
        var val = wordMap[ key ];
        newArray.push( {"text":key, "weight":val} );
    }
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
    var sentHistSvg;

    var summaryTotalTweets = $('#summaryTotalTweets');
    var summaryOriginalTweets = $('#summaryOriginalTweets');
    var summaryTotalHashtags = $('#summaryTotalHashtags');
    var summaryUniqueHashtags = $('#summaryUniqueHashtags');
    
    var sentimentPlot = $('#sentimentSeriesContainer');

    var geoFilter = $('#geoFilter');

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
        var rowHTML = '<tr class="sparkline-rank-' + i + '" style="display:none"></tr>';
        top10TagTableBody.append(rowHTML);
    }
    var top20TagTableBody = $("#top20TagTableBody");
    for( i=10; i < 20; i+=1){
        var rowHTML = '<tr class="sparkline-rank-' + i + '" style="display:none"></tr>';
        top20TagTableBody.append(rowHTML);
    }
    top10TagTableBody.children("tr").append(
        '<td class="rank"><td class="tag"></td><td class="count"></td><td class="mean"></td><td class="last10"></td><td class="sparkline"><div class="sparklineContainer"></div></td>');
    top20TagTableBody.children("tr").append(
        '<td class="rank"><td class="tag"></td><td class="count"></td><td class="mean"></td><td class="last10"></td><td class="sparkline"><div class="sparklineContainer"></div></td>');
    $("#topTags").find("div.sparklineContainer").map(function(){
        $(this).highcharts('SparkLine', { series: [{}] });
    });

    // Initialize Top Related Elements Table
    var top10RelatedTagBody = $("#top10RelatedTagBody");
    for( i=0; i < 10; i+=1){
        var rowHTML = '<tr class="related-hashtag-rank-' + i + '" style="display:none"></tr>';
        top10RelatedTagBody.append(rowHTML);
    }
    var top10RelatedLinkBody = $("#top10RelatedLinkBody");
    for( i=0; i < 10; i+=1){
        var rowHTML = '<tr class="related-link-rank-' + i + '" style="display:none"></tr>';
        top10RelatedLinkBody.append(rowHTML);
    }
    top10RelatedTagBody.children("tr").append(
        '<td class="rank"><td class="tag"></td><td class="count"></td>');
    top10RelatedLinkBody.children("tr").append(
        '<td class="rank"><td class="link text-left"></td><td class="count"></td>');

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

    // D3 Sentiment Histogram Plot

    var pheight = 400;
    var pwidth = 600;
    var xcushion = 30;
    var ycushion = 20;

    function minh(plotRow){
    return 2.5*ycushion + plotRow * pheight;
    }
    function maxh(plotRow){
    return (1 + plotRow) * pheight - ycushion;
    }
    function minw(plotCol){
    return xcushion + pwidth * plotCol;
    }
    function maxw(plotCol){
    return  (1 + plotCol) * pwidth - xcushion;
    }

    var sentHistSvg = d3.select("#sentimentHistogramContainer").append("svg")
        .attr("width", pwidth)
        .attr("height", pheight)
        .attr("x", 0)
        .attr("y", 0)

    sentHistSvg.append("text")
        .attr({
          x: 550 / 2, 
          y: minh(0) * .4,
          'text-anchor': 'middle',
          class: 'title'
        })
        .text("Distribution of Sentiment for Non-Neutral Tweets");


    var negSentimentColorScale = d3.scale.sqrt()
        .domain([-1, 0])
        .rangeRound([ 0,230])

    var posSentimentColorScale = d3.scale.sqrt()
        .domain([0, 1]) 
        .rangeRound([230,0])


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
    var updateSummary = function(){

        summaryTotalTweets.text(rawData["TOTAL_TWEET_COUNT"]);
        summaryOriginalTweets.text(rawData["TOTAL_TWEET_COUNT_NON_RT"]);
        summaryTotalHashtags.text(rawData["TOTAL_TAG_COUNT"]);
        summaryUniqueHashtags.text(rawData["TOTAL_TAG_COUNT_NON_RT"]);

    };

    var wordCloud = $('#wordCloudContainer');
    wordCloud.jQCloud([{"text":"None","weight":1}],{
        width:450,
        height:350,
        autoresize: true
    });

    var updateRelatedElements = function(){

        var relHash;
        var relLink;

        if( hashtagFilters != null){
            // console.log(hashtagFilters);
            var relHash = prepForTopRelated(
                    combineTopRelatedElementCounts("related_hashtags", rawData, hashtagFilters)).sort(
                            function compare(a,b) {
                              if (a[1] > b[1])
                                return -1;
                              else if (a[1] < b[1])
                                return 1;
                              else 
                                return 0;
                            }
                        )
                        .slice(0,10);
            var relLink = prepForTopRelated(
                    combineTopRelatedElementCounts("related_links", rawData, hashtagFilters)).sort(
                            function compare(a,b) {
                              if (a[1] > b[1])
                                return -1;
                              else if (a[1] < b[1])
                                return 1;
                              else 
                                return 0;
                            }
                        )
                        .slice(0,10);
        } else {
            var relHash = rawData["TOP_TAGS"].filter(function(x){
                return x[0] != "(No Hashtag)";
            }).slice(0,10);
            var relLink = rawData["TOP_LINKS"].slice(0,10);
        }

        // console.log(relHash);
        // console.log(relLink);

        relHash.map(function(tag,i){
            var row = $(".related-hashtag-rank-"+i);
            row.css("display","table-row");
            row.find("td.rank").text(i+1);
            row.find("td.tag").html("<a href='https://twitter.com/hashtag/"+tag[0]+"' target='_blank'>"+tag[0]+"</a>");
            row.find("td.count").text(tag[1]);

        });
        if(relHash.length < 10){
            d3.range( relHash.length, 10 ).map(function(i){
                var row = $(".related-hashtag-rank-"+i);
                row.css("display","none");
                // row.css("visibility","hidden");
            })
        }

        relLink.map(function(x){
            var spl = x[0].split("||");
            return [spl[0], spl[1], x[1]];
        })
        .map(function(tag,i){
            // console.log(tag);
            var row = $(".related-link-rank-"+i);
            row.css("display","table-row");
            row.find("td.rank").text(i+1);
            row.find("td.link").html("<a href='"+tag[0]+"' target='_blank'>"+tag[1]+"</a>");
            row.find("td.count").text(tag[2]);

        });
        if(relLink.length < 10){
            d3.range( relLink.length, 10 ).map(function(i){
                var row = $(".related-link-rank-"+i);
                row.css("display","none");
                // row.css("visibility","hidden");
            })
        }
    };

    var updateSentimentHistogram = function(){
        ///
        // SENTIMENT HISTOGRAM
        ///

        var sentimentSeriesRaw;
        if(hashtagFilters == null){
            sentimentSeriesRaw = rawData["GLOBAL_SENTIMENT"].map(function(x){
                return x[1];
            }).filter(function(x){
                return Math.abs(x) != 0;
            });
        } else{
            sentimentSeriesRaw = combineFilteredSentimentArrays(rawData, hashtagFilters).map(function(x){
                return x[1];
            }).filter(function(x){
                return Math.abs(x) != 0;
            });
        }

        // A formatter for counts.
        var sentHistFormatCount = d3.format(",.0f");

        var sentHistXScale = d3.scale.linear()
            .domain([-1, 1])
            .range([minw(0), maxw(0)]);

        // Generate a histogram using twenty uniformly-spaced bins.
        var sentHistLayout = d3.layout.histogram()
            .bins(sentHistXScale.ticks(20))
            (sentimentSeriesRaw);

        var sentHistYScale = d3.scale.linear()
            .domain([0, d3.max(sentHistLayout, function(d) { return d.y; })])
            .range([maxh(0), minh(0)]);

        var sentHistXAxis = d3.svg.axis()
            .scale(sentHistXScale)
            .orient("bottom");

        var sentHistYAxis = d3.svg.axis()
            .scale(sentHistYScale)
            .ticks(6)
            .orient("right");

        var sentHistBars = sentHistSvg.selectAll('rect.barSh')
            .data(sentHistLayout);

        var sentHistLabels=sentHistSvg.selectAll(".labelSh")
            .data(sentHistLayout);

        sentHistBars.enter()
          .append("rect")
            .attr("class", "barSh")
            .attr("x", function(d){return sentHistXScale(d.x);})
            .attr("y", function(d) { return sentHistYScale(d.y); })
            .attr('fill','blue')
            .attr('value', function(d){
              // console.log(sentHistXScale.range()[1]);
              // console.log( (sentHistXScale.range()[1] - sentHistXScale.range()[0]) / sentHistLayout.length );
            })
            .attr('fill',function(d){ 
                    if( d.x >= 0.0) {
                      return 'rgb('+posSentimentColorScale(d.x)+ ',' +posSentimentColorScale(d.x)+ ',230)';
                    }
                    else {
                      return 'rgb(230,'+negSentimentColorScale(d.x)+','+negSentimentColorScale(d.x)+')';
                    }
                  })
            .attr("width", ( (sentHistXScale.range()[1] - sentHistXScale.range()[0]) / sentHistLayout.length ) - 2 )
            .attr("height", function(d) { return maxh(0) - sentHistYScale(d.y); });

        sentHistLabels.enter()
          .append("text")
            .attr('class', 'labelSh')
            .style('font-size', 12)
            .attr("dy", ".75em")
            .attr("y", function(d) { return sentHistYScale(d.y) - 13.5; })
            .attr("x", function(d){return sentHistXScale(d.x) + 13;})
            .attr("text-anchor", "middle")
            .attr('fill','black')
            .text(function(d) { return sentHistFormatCount(d.y); });

        sentHistBars.transition()
          .attr("y", function(d) { return sentHistYScale(d.y); })
          .attr("height", function(d) { return maxh(0) - sentHistYScale(d.y); });

        sentHistLabels.transition()
          .attr("y", function(d) { return sentHistYScale(d.y) - 14; })  
          .text(function(d) { return sentHistFormatCount(d.y); });

        d3.select('#xAxisSh')
          .remove();

        d3.select('#yAxisSh') 
          .remove();

        sentHistSvg.append("g")
            .attr("id", "xAxisSh")
            .attr("class", "axis")
            .attr("transform", "translate(0," + maxh(0) + ")")
            .call(sentHistXAxis);


        sentHistSvg.append("g")
            .attr("id", "yAxisSh")
            .attr("class", "axis")
            .attr("transform", "translate(" + maxw(0) + ",0)")
            .call(sentHistYAxis);

    }
    

    
    var updateWordCloud = function(){

        var newWords;

        if( hashtagFilters == null ){
            newWords = rawData["TOP_WORDS"].map(function(x){
                return {"text":x[0], "weight":x[1]};
            });
        } else {
            newWords = prepForWordCloud(
                    combineTopRelatedElementCounts("word_count", rawData, hashtagFilters)
                    );
            // console.log(newWords);
        }

        newWords = newWords.sort(
            function compare(a,b) {
              if (a.weight > b.weight)
                return -1;
              else if (a.weight < b.weight)
                return 1;
              else 
                return 0;
            }
        )
        .slice(0,50)
        .map(function(x){
            return {"text":x["text"], "weight": Math.log(x["weight"]) };
        });
        // console.log(newWords);

        wordCloud.jQCloud('update', newWords);
    };

    var updateSentimentPlotSeries = function(){
        var sentimentSeriesRaw;
        if(hashtagFilters == null){
            sentimentSeriesRaw = rawData["GLOBAL_SENTIMENT"];
        } else{
            sentimentSeriesRaw = combineFilteredSentimentArrays(rawData, hashtagFilters);
        }

        // TODO enter code to control for retweets HERE

        var sentimentSeriesBuckets = bucketSentimentArray(sentimentSeriesRaw).map(function(x){
            return [ x[0]*1000, x[1] ];
        });
        var sentimentSeriesMABuckets = movingAverageSentimentArray(sentimentSeriesBuckets, 15);

        sentimentPlotSeries[0].setData(sentimentSeriesBuckets);
        sentimentPlotSeries[1].setData(sentimentSeriesMABuckets);

    };

    var updateSparklines = function(){
        var topTags = rawData["TOP_TAGS"].filter(function(x){
            return x[0] != "(No Hashtag)";
        }).slice(0,20);
        topTags.map(function(tag,i){
            var row = $(".sparkline-rank-"+i);
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
                var row = $(".sparkline-rank-"+i);
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
        
        updateSummary();
        updateSparklines();
        updateSentimentHistogram();
        updateSentimentPlotSeries();
        updateWordCloud();  
        updateRelatedElements();
    };

    var launchVisuals = function(){
        refreshLoop = setInterval( updateData, 2000 );
        filterOptions.css('display','none');
        streamChoice.css("display","none");
        pauseButton.css("display","inline");
        playButton.css("display","none");
        controlPanel.css("display","inline");
        liveVisuals.css("display","inline");
    };


    filterButton.on('click', function(){
        streamChoice.css("display","none");
        filterOptions.css('display','');
        geoFilter.locationpicker(
            {
                location: {latitude: 40.7324319, longitude: -73.82480799999996},
                // locationName: "Philadelphia, PA",
                radius: 150000,
                zoom: 5,
                scrollwheel: true,
                inputBinding: {
                    latitudeInput: null,
                    longitudeInput: null,
                    radiusInput: $('#geoFilterRadius'),
                    locationNameInput: $('#geoFilterLocation')
                },
                enableAutocomplete: true,
                enableReverseGeocode: true,
                // oninitialized: function(currentLocation, radius, isMarkerDropped) {
                //     backendGeoFilters = geoPointRadiusToBox(currentLocation, radius);
                // },
                onchanged: function(currentLocation, radius, isMarkerDropped) {
                    backendGeoFilters = geoPointRadiusToBox(currentLocation, radius);
               }
            }
        );
    });

    startFilterButton.on('click', function(){
        filterOptions.css('display','none');

        var filterText = backendHashtagFilters == null ? "": "filters="+backendHashtagFilters;
        var mapText = "locations=" +backendGeoFilters;

        var whichFilters =  [ $('#useTextFiltersCheckbox').is(":checked"), $('#useGeoFiltersCheckbox').is(":checked") ];

        if( whichFilters[0] & whichFilters[1] ){
            var getUrl = "/start-stream?" + filterText + "&" + mapText ;
        } else if( whichFilters[0] & !(whichFilters[1]) ){
            var getUrl = "/start-stream?" + filterText;
        } else if( !(whichFilters[0]) & whichFilters[1] ){
            var getUrl = "/start-stream?" + mapText;
        } else{
            var getUrl = "/start-stream";   
        }

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
        refreshLoop = setInterval( updateData, 2000 );
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

});