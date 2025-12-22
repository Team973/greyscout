// TODO: fix types
// @ts-nocheck

import { sortKeyValueArrays } from "@/lib/util";

export function computeBarChartDataModel(data, valueColumn, labelColumn = null, isQuery = false, isSorted = false, maxDataPoints = null) {
    // This function assumes the keys of "data" are the labels.
    var dataset = {
        "series": valueColumn,
        "labels": [],
        "values": []
    };

    if (isQuery) {
        data.forEach(row => {
            dataset.labels.push(row[labelColumn]);
            dataset.values.push(row[valueColumn]);
        })
    } else {
        dataset.labels = Object.keys(data);
        dataset.labels.forEach(element => {
            dataset.values.push(data[element][valueColumn])
        });
    }


    // Sort the data if requested.
    if (isSorted) {
        const sorted = sortKeyValueArrays(dataset.labels, dataset.values);

        // Reconstruct a key array and a value array.
        dataset.labels = [];
        dataset.values = [];
        for (const [key, val] of sorted) {
            dataset.labels.push(key);
            dataset.values.push(val);
        }
    }

    // Limit the amount of data shown if requested.
    if (maxDataPoints != null) {
        dataset.labels = labels.slice(0, maxDataPoints);
        dataset.values = values.slice(0, maxDataPoints);
    }

    return dataset;
}
