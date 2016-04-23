Highcharts.SparkLine = function (a, b, c) {
        var hasRenderToArg = typeof a === 'string' || a.nodeName,
            options = arguments[hasRenderToArg ? 1 : 0],
            defaultOptions = {
                chart: {
                    renderTo: (options.chart && options.chart.renderTo) || this,
                    backgroundColor: null,
                    type: 'line',
                    // type: 'spline',
                    margin: [0, 0, 0, 0],
                    width: 175,
                    height: 20,
                    style: {
                        overflow: 'visible'
                        // overflow: 'hidden'
                    },
                    animation: false,
                    // skipClone: true,
                },
                title: {
                    text: ''
                },
                credits: {
                    enabled: false
                },
                xAxis: {
                    type: "datetime",
                    lineColor: 'transparent',
                    labels: {
                        enabled: false
                    },
                    title: {
                        text: null
                    },
                    startOnTick: false,
                    endOnTick: false,
                    tickPositions: []
                },
                yAxis: {
                    min: -1,
                    max: 1,
                    endOnTick: false,
                    startOnTick: false,
                    labels: {
                        enabled: false
                    },
                    title: {
                        text: null
                    },
                    // tickPositions: [0],
                    plotLines: [{
                        color: '#FF0000',
                        width: 1.5,
                        value: 0,
                        dashStyle: 'dash',
                        animation: false
                    }]
                },
                legend: {
                    enabled: false
                },
                tooltip: {
                    enabled: false,
                    animation: false,
                    backgroundColor: null,
                    borderWidth: 0,
                    shadow: false,
                    useHTML: true,
                    hideDelay: 0,
                    shared: true,
                    padding: 0,
                    positioner: function (w, h, point) {
                        return { x: point.plotX - w / 2, y: point.plotY - h };
                    }
                },
                plotOptions: {
                    series: {
                        name: "Sentiment Score",
                        animation: false,
                        lineWidth: 1.5,
                        shadow: false,
                        states: {
                            hover: {
                                enabled: false
                            }
                        },
                        marker: {
                            radius: 2.25,
                        }
                    },
                }
                    // column: {
                    //     negativeColor: '#910000',
                    //     borderColor: 'silver'
                    // }
            };

        options = Highcharts.merge(defaultOptions, options);

        return hasRenderToArg ?
            new Highcharts.Chart(a, options, c) :
            new Highcharts.Chart(options, b);
    };

