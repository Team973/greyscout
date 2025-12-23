// TODO: fix types
// @ts-nocheck

import { sortKeyValueArrays } from "@/lib/util";

export function computeCategoricalDataSeries(data, valueColumn, labelColumn = null, isQuery = false, isSorted = false, maxDataPoints = null) {
    // This function assumes the keys of "data" are the labels.
    var dataSeries = {
        "name": valueColumn,
        "labels": [],
        "y": []
    };

    if (isQuery) {
        data.forEach(row => {
            dataSeries.labels.push(row[labelColumn]);
            dataSeries.y.push(row[valueColumn]);
        })
    } else {
        dataSeries.labels = Object.keys(data);
        dataSeries.labels.forEach(element => {
            dataSeries.y.push(data[element][valueColumn])
        });
    }


    // Sort the data if requested.
    if (isSorted) {
        const sorted = sortKeyValueArrays(dataSeries.labels, dataSeries.y);

        // Reconstruct a key array and a value array.
        dataSeries.labels = [];
        dataSeries.y = [];
        for (const [key, val] of sorted) {
            dataSeries.labels.push(key);
            dataSeries.y.push(val);
        }
    }

    // Limit the amount of data shown if requested.
    if (maxDataPoints != null) {
        dataSeries.labels = labels.slice(0, maxDataPoints);
        dataSeries.y = y.slice(0, maxDataPoints);
    }

    return dataSeries;
}

export function categoricalDataSeriesToChartJSDatasets(data) {
    let labels = [];
    if (data.length > 0) {
        labels = data[0].labels;
    }

    let datasets = []
    data?.forEach(series => {
        const dataset = {
            label: series.name,
            data: series.y
        };
        datasets.push(dataset);
    });

    return datasets;
}