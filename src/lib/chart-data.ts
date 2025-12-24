// TODO: fix types
// @ts-nocheck

import { sortKeyValueArrays } from "@/lib/util";

export function computeDiscreteDataSeries(data, labelColumn, valueColumn, isSorted = false, maxDataPoints = null) {
    // This function assumes the keys of "data" are the labels.
    var dataSeries = {
        "name": valueColumn,
        "labels": [],
        "y": []
    };

    data.forEach(row => {
        dataSeries.labels.push(row[labelColumn]);
        dataSeries.y.push(row[valueColumn]);
    });

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

export function discreteDataSeriesToChartJSDatasets(data) {
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

export function computeCartesianDataSeries(data, xColumn, yColumn, labelColumn, isQuery = false) {
    // The labels in this data series are the values that would show up in a chart tooltip.
    var dataSeries = {
        "name": yColumn,
        "labels": [],
        "x": [],
        "y": []
    };

    if (isQuery) {
        data.forEach(row => {
            dataSeries.labels.push(row[labelColumn]);
            dataSeries.x.push(row[xColumn]);
            dataSeries.y.push(row[yColumn]);
        })
    } else {
        dataSeries.labels = Object.keys(data);
        dataSeries.labels.forEach(element => {
            dataSeries.x.push(data[element][xColumn]);
            dataSeries.y.push(data[element][yColumn]);
        });
    }

    // TODO: data transforms.

    return dataSeries;
}

export function cartesianDataSeriesToChartJSDatasets(data) {
    if (data.length == 0) {
        return [];
    }
    if (!data[0]?.x || !data[0]?.y || !data[0]?.name) {
        return [];
    }

    let datasets = []
    data?.forEach(series => {
        console.log(series);
        // Populate an array of values, which are x,y coordinates.
        let xy_values = [];
        for (var i = 0; i < series.x.length; i++) {
            const xVal = series.x[i];
            const yVal = series.y[i];
            xy_values.push({ "x": xVal, "y": yVal });
        }

        const dataset = {
            label: series.name,
            data: xy_values
        };
        datasets.push(dataset);
    });

    return datasets;
}

export function computeSampledDataSeries(data, keyColumn, valueColumn, isSorted = false, maxDataPoints = null) {
    let dataseriesMap = {}
    data.forEach(row => {
        const key = row[keyColumn];
        if (!Object.keys(dataseriesMap).includes(key)) {
            dataseriesMap[key] = [row[valueColumn]];
        } else {
            dataseriesMap[key].push(row[valueColumn]);
        }
    });

    let labels = Object.keys(dataseriesMap);
    let values = Object.values(dataseriesMap);

    // Sort the data if requested.
    if (isSorted) {
        const sorted = sortKeyValueArrays(labels, values);

        // Reconstruct a key array and a value array.
        labels = [];
        values = [];
        for (const [key, val] of sorted) {
            labels.push(key);
            values.push(val);
        }
    }

    // Limit the amount of data shown if requested.
    if (maxDataPoints != null) {
        labels = labels.slice(0, maxDataPoints);
        values = values.slice(0, maxDataPoints);
    }

    let sampledDataSeries = {
        labels: labels,
        values: values
    };

    return [sampledDataSeries];
}
