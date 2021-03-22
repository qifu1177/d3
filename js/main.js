function countriesObj(cu) {
    let countries1 = arguments.length > 0 ? cu : countries;
    var obj = {};
    for (c of countries1) {
        obj[c.name] = c.code.toLowerCase();
    }
    return obj;
}
function createChartData(cf, d) {
    let config1 = arguments.length > 0 ? cf : config, data1 = arguments.length > 1 ? d : data;
    var chartData = {};
    var patt = /^\d+\.*\d*$/i;
    let names = new Set(data1.map(d => d.name));
    let temp = d3.nest().key(d => d.name).rollup(d => {
        return d.map(item => {
            item.date = new Date(item.date).getTime();
            return item;
        });
    }).entries(data1);
    data1 = [];
    for (datas of temp) {
        if (datas.value.length > 0) {
            let code = config1.countries[datas.key];
            if (code == undefined)
                continue;
            datas.value.sort((left, right) => { return left.date - right.date; });
            data1.push(datas.value[0]);
        }
        let lastPro = 1;
        datas.value[0].value = parseFloat(patt.exec(datas.value[0].value) || 0);
        datas.value[0].delta = 0;
        for (let i = 1, n = datas.value.length; i < n; i++) {
            if (patt.test(datas.value[i].value)) {
                datas.value[i].value = parseFloat(datas.value[i].value);
                datas.value[i].delta = datas.value[i].value - datas.value[i - 1].value;
                if (datas.value[i - 1].value > 0)
                    lastPro = datas.value[i].value / datas.value[i - 1].value;
            }
            else if (i >= n - 3) {
                datas.value[i].value = datas.value[i - 1].value * lastPro;
                datas.value[i].delta = datas.value[i].value - datas.value[i - 1].value;
                lastPro = 1;
            } else {
                datas.value[i].value = 0;
                datas.value[i].delta = 0;
            }
            data1.push(datas.value[i]);
        }
    }
    temp = d3.nest().key(d => d.date).rollup(d => {
        d.sort((left, right) => { return right.delta - left.delta; });
        return d;
    }).entries(data1);
    chartData.deltaValue = {};
    for (let d of temp) {
        let d1 = [];
        for (let i = 0, n = d.value.length; i < n && i < 3; i++) {
            if (d.value[i].delta > 0)
                d1.push({ name: d.value[i].name, delta: Math.round(d.value[i].delta / config1.factor), rank: i + 1 });
        }
        if (d1.length > 0)
            chartData.deltaValue[d.key] = d1;
    }
    temp = d3.nest().key(d => d.date).rollup(d => {
        let tmpData = d.map(item => {
            return [item.name, item.value / config1.factor];
        });
        return new Map(tmpData);
    }).entries(data1);
    let datavalues = temp.map(d => [d.key, d.value]);
    function rank(value) {
        const data = Array.from(names, name => ({ name, value: value(name) }));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(config1.n, i);
        return data;
    }
    function GetValue(d) {
        return function (name) {
            return datavalues[d][1][name];
        }
    }
    let tmpData = d3.pairs(datavalues);

    chartData.keyframes = [];
    let ka, a, kb, b;
    for ([[ka, a], [kb, b]] of d3.pairs(datavalues)) {
        for (let i = 0; i < config1.k; ++i) {
            const t = i / config1.k;
            chartData.keyframes.push([
                new Date(ka * (1 - t) + kb * t),
                rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t)
            ]);
        }
    }
    chartData.keyframes.push([new Date(kb * 1), rank(name => b.get(name) || 0)]);
    tmpData = [];
    for (let a of chartData.keyframes)
        for (let d of a[1])
            tmpData.push(d);
    let tmpData2 = d3.nest().key(d => d.name).entries(tmpData);
    let nameframes = tmpData2.map(d => [d.key, d.values]);

    tmpData = [];
    for (let a of nameframes)
        for (let d of a[1])
            tmpData.push(d);
    //var nameframes = d3.groups(keyframes.flatMap(([, data]) => data), d => d.name);
    chartData.prev = new Map(d3.pairs(tmpData, (a, b) => [a, b]));
    chartData.next = new Map(d3.pairs(tmpData));
    return chartData;
}

function chart(cf, d, cd) {
    let config1 = arguments.length > 0 ? cf : config, data1 = arguments.length > 1 ? d : data;

    var chartData = arguments.length > 2 ? cd : createChartData(config1, data1);
    var chart = {};
    var x = d3.scaleLinear([0, 1], [config1.margin.left, config1.width-config1.barSize - config1.margin.right]);
    var y = d3.scaleBand()
        .domain(d3.range(config1.n + 1))
        .rangeRound([config1.margin.top, config1.margin.top + config1.barSize * (config1.n + 1 + 0.1)])
        .padding(0.1);
    const colorList = ["#008B8B", "#006400", "#556B2F", "#DC143C", "#8B008B", "#FF8C00", "#556B2F", "#DAA520"];
    var color = function () {
        return d => {
            let i = d.name.charCodeAt(0) % colorList.length;
            return colorList[i];
        };
    };
    function getDeltaData(date) {
        let year = (new Date(date)).getFullYear();
        date = (new Date("" + year + "-01-01")).getTime();
        data = chartData.deltaValue[date];
        return data;
    }
    function getImg(name) {
        return config1.getImg(name);
    }
    function textTween(a, b) {
        const i = d3.interpolateNumber(a, b);
        return function (t) {
            this.textContent = config1.formatNumber(i(t));
        };
    }
    function img(svg) {
        let img = svg.selectAll("image");
        return ([date, data], transition) => img = img
            .data(data.slice(0, config1.n), d => d.name)
            .join(
                enter => enter.append("image")
                    .attr("transform", d => `translate(${x((chartData.prev.get(d) || d).value)},${y((chartData.prev.get(d) || d).rank)})`)
                    .attr("xlink:href", d => getImg(d.name))
                    .attr("width", config1.barSize)
                    .attr("height", y.bandwidth())
                    .attr("x",  0)
                    .attr("y", 0),
                update => update,
                exit => exit.transition(transition).remove()
                    .attr("transform", d => `translate(${x((chartData.next.get(d) || d).value)},${y((chartData.next.get(d) || d).rank)})`)
                    .attr("y", 0)
            )
            .call(bar => bar.transition(transition)
                .attr("transform", d => `translate(${x(d.value)},${y(d.rank)})`)
                .attr("y", 0));
    }
    function bars(svg) {
        let bar = svg.append("g")
            .attr("fill-opacity", 1)
            .selectAll("rect");

        return ([date, data], transition) => bar = bar
            .data(data.slice(0, config1.n), d => d.name)
            .join(
                enter => enter.append("rect")
                    .attr("fill", color())
                    .attr("height", y.bandwidth())
                    .attr("x", x(0))
                    .attr("y", d => y((chartData.prev.get(d) || d).rank))
                    .attr("width", d => x((chartData.prev.get(d) || d).value) - x(0)),
                update => update,
                exit => exit.transition(transition).remove()
                    .attr("y", d => y((chartData.next.get(d) || d).rank))
                    .attr("width", d => x((chartData.next.get(d) || d).value) - x(0))
            )
            .call(bar => bar.transition(transition)
                .attr("y", d => y(d.rank))
                .attr("width", d => x(d.value) - x(0)));
    }
    function labels(svg) {
        let label = svg.append("g")
            .style("font", "bold 6px var(--sans-serif)")
            .style("font-variant-numeric", "tabular-nums")
            .attr("text-anchor", "end")
            .selectAll("text");

        return ([date, data], transition) => {
            label = label
                .data(data.slice(0, config1.n), d => d.name)
                .join(
                    enter => {
                        return enter.append("text")
                            .attr("transform", d => `translate(${x(0)},${y((chartData.prev.get(d) || d).rank)})`)
                            .attr("y", y.bandwidth() / 2)
                            .attr("x", -6)
                            .attr("dy", "0.35em")
                            .text(d => d.name);
                    },
                    update => update,
                    exit => {
                        return exit.transition(transition).remove()
                            .attr("transform", d => `translate(${x(0)},${y((chartData.next.get(d) || d).rank)})`);
                    }
                )
                .call(bar => {
                    return bar.transition(transition)
                        .attr("transform", d => `translate(${x(0)},${y(d.rank)})`);
                });
            return label;
        }
    }

    function labels2(svg) {
        let label = svg.append("g")
            .style("font", "bold 6px var(--sans-serif)")
            .style("font-variant-numeric", "tabular-nums")
            .attr("text-anchor", "start")
            .selectAll("text");

        return ([date, data], transition) => {
            label = label
                .data(data.slice(0, config1.n), d => d.name)
                .join(
                    enter => {
                        return enter.append("text")
                            .attr("transform", d => `translate(${x((chartData.prev.get(d) || d).value)+config1.barSize},${y((chartData.prev.get(d) || d).rank)})`)
                            .attr("fill-opacity", 0.7)
                            .attr("font-weight", "normal")
                            .attr("y", y.bandwidth() / 2)
                            .attr("x", 6)
                            .attr("dy", "0.35em");
                    },
                    update => update,
                    exit => {
                        return exit.transition(transition).remove()
                            .attr("transform", d => `translate(${x((chartData.next.get(d) || d).value)+config1.barSize},${y((chartData.next.get(d) || d).rank)})`)
                            .tween("text", d => textTween(d.value, (chartData.next.get(d) || d).value));
                    }
                )
                .call(bar => {
                    return bar.transition(transition)
                        .attr("transform", d => `translate(${x(d.value)+config1.barSize},${y(d.rank)})`)
                        .tween("text", d => textTween((chartData.prev.get(d) || d).value, d.value));
                });
            return label;
        }
    }
    function axis(svg) {
        const g = svg.append("g")
            .attr("transform", `translate(0,${config1.margin.top})`);

        const axis = d3.axisTop(x)
            .ticks(config1.width / 160)
            .tickSizeOuter(0)
            //.tickSizeInner(0);
            .tickSizeInner( -config1.barSize * (config1.n + y.padding()));

        return (_, transition) => {
            g.transition(transition).call(axis);
            g.select(".tick:first-of-type text").remove();
            g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
            g.select(".domain").remove();
        };
    }

    function ticker(svg) {
        svg.append("text").style("font", `bold var(--sans-serif)`).style("font-size", `${config1.legendFontSize}px`).attr("text-anchor", "start").attr("x", config1.margin.left).attr("y", 16).text(config1.legend);
        const now = svg.append("text")
            .style("font", `bold ${config1.tickerSize}px var(--sans-serif)`)
            .style("font-size", `${config1.tickerSize}px`)
            .style("font-variant-numeric", "tabular-nums")
            .attr("text-anchor", "middle")
            .attr("width", config1.deltaImg.width)
            .attr("height", config1.deltaImg.height)
            .attr("x", config1.width - config1.deltaImg.marginRight - config1.deltaImg.marginRight)
            .attr("y", config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * 1)
            .attr("dy", "0.32em")
            .attr("dx", -80)
            .text(config1.formatDate(chartData.keyframes[0][0]));

        return ([date], transition) => {
            let data = getDeltaData(date);
            let text = config1.formatDate(date);
            if (data != undefined)
                text = config1.tickerContent + text;
            transition.end().then(() => now.text(text));
        };
    }
    function topDelta(svg) {
        let deltaImgs = svg.append("g").selectAll("image");
        let deltaText = svg.append("g").style("font", "bold 6px var(--sans-serif)")
            .style("font-variant-numeric", "tabular-nums")
            .attr("text-anchor", "end")
            .selectAll("text");
        return function ([date], transition) {
            let data = getDeltaData(date);
            if (data == undefined)
                return;
            deltaImgs = deltaImgs.data(data, d => d.name).join(
                enter => {
                    return enter.append("image")
                        .attr("xlink:href", d => getImg(d.name))
                        .attr("width", config1.deltaImg.width)
                        .attr("height", config1.deltaImg.height)
                        .attr("x", config1.width - config1.deltaImg.marginRight - config1.deltaImg.width)
                        .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * d.rank);
                },
                update => update,
                exit => {
                    return exit.transition(transition).remove()
                        .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * 4);
                }
            ).call(function (img) {
                return img.transition(transition)
                    .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * d.rank);
            });

            deltaText = deltaText.data(data, d => d.name).join(
                enter => {
                    return enter.append("text")
                        .attr("width", config1.deltaImg.width)
                        .attr("height", config1.deltaImg.height)
                        .attr("text-anchor", "middle")
                        .attr("x", config1.width - config1.deltaImg.marginRight - config1.deltaImg.width)
                        .attr("dx", 100)
                        .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * (1 + d.rank))
                        .text(d => d.name + ": " + config1.formatNumber(d.delta));
                },
                update => update,
                exit => {
                    return exit.transition(transition).remove()
                        .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * 5);
                }
            ).call(function (img) {
                return img.transition(transition)
                    .attr("y", d => config1.margin.top + config1.deltaImg.marginTop + config1.deltaImg.height * (1 + d.rank))
                    .text(d => d.name + ": " + config1.formatNumber(d.delta));
            });
        };
    }
    //d3 = require("d3@5", "d3-array@2");
    const svg = d3.select("svg")
        .attr("viewBox", [0, 0, config1.width, config1.height]);

    const updateBars = bars(svg);
    const updateImgs = img(svg);
    const updateAxis = axis(svg);
    const updateLabels = labels(svg);
    const updateLabels2 = labels2(svg);
    const updateTicker = ticker(svg);
    const updateDelta = topDelta(svg);

    async function updateChart(keyframe) {
        const transition = svg.transition()
            .duration(config1.duration)
            .ease(d3.easeLinear);

        // Extract the top bar’s value.
        x.domain([0, keyframe[1][0].value]);
        updateImgs(keyframe, transition);
        updateAxis(keyframe, transition);
        updateBars(keyframe, transition);
        updateLabels(keyframe, transition);
        updateLabels2(keyframe, transition);
        updateTicker(keyframe, transition);
        if (config1.showDelta)
            updateDelta(keyframe, transition);

        //invalidation.then(() => svg.interrupt());
        await transition.end();
    };

    async function run(callback) {
        //yield svg.node();
        for (let keyframe of chartData.keyframes) {
            await updateChart(keyframe);
        }
        if (typeof callback == "function") {
            callback();
        }
    };
    chart.run = run;
    return chart;
}