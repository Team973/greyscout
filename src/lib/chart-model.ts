// TODO: fix types
// @ts-nocheck


import { computeDiscreteDataSeries, computeCartesianDataSeries, computeSampledDataSeries, computeRadarDataSeries } from "@/lib/chart-data";
import { queryTeamMatchData, queryEventData } from "@/lib/data-query";

import { aggregateData, countDiscreteData } from "@/lib/data-transforms";
import { getThemeColors } from '@/lib/theme';

import { mean } from "simple-statistics";


export type ChartOptions = {
    isSorted: Boolean,
    isNormalized: Boolean,
    isHorizontal: Boolean,
    xRange: Object,
    yRange: Object,
    height: Number,
    heightRatio: Number
}

export type ChartInputs = {
    type: String,
    independentColumn: String,

    ySeries: String,
    xSeries: String,

    // Stacked Bar + Radar Chart specific inputs
    dimensions: Array,

    // RadarChart specific inputs
    comparisonItems: Array,

    // Optional items:
    options: ChartOptions
};

export type QueryInputs = {
    type: String,

    teamNumber: String,
    eventId: String,

    aggregationFn: String
}

export async function updateChartModels(charts) {
    let chartModels = [];
    charts.forEach(chart => {
        const chartModel = getChartModel(chart.queryInputs, chart.chartInputs);
        chartModels.push(chartModel);
    })

    return chartModels;
}

export async function getChartModel(queryInputs: QueryInputs, chartInputs: ChartInputs) {
    let chartModel = {
        style: [],
        data: [],
        options: {}
    };

    let dbData = null;
    if (queryInputs.type == "team_query") {
        dbData = await queryTeamMatchData(queryInputs.teamNumber, queryInputs.eventId);
    } else if (queryInputs.type == "event_query") {
        dbData = await queryEventData(queryInputs.eventId);
    }

    if (!dbData) {
        return chartModel;
    }

    // Perform data aggregation when in certain modes.
    let processedData = dbData;
    if (queryInputs.aggregationFn == "mean") {
        processedData = aggregateData(dbData, chartInputs.independentColumn, mean);
    } else if (queryInputs.aggregationFn == "count") {
        processedData = countDiscreteData(dbData, chartInputs.independentColumn, chartInputs.ySeries);
    }

    // Compute the chart data series.
    if (chartInputs.type == "bar" || chartInputs.type == "line") {
        chartModel.data.push(computeDiscreteDataSeries(processedData, chartInputs.independentColumn, chartInputs.ySeries, chartInputs.options.isSorted, chartInputs.options.isNormalized));
    } else if (chartInputs.type == "scatter") {
        chartModel.data.push(computeCartesianDataSeries(processedData, chartInputs.xSeries, chartInputs.ySeries, chartInputs.independentColumn))
    } else if (chartInputs.type == "boxplot") {
        chartModel.data = computeSampledDataSeries(processedData, chartInputs.independentColumn, chartInputs.ySeries, chartInputs.options.isSorted);
    } else if (chartInputs.type == "stacked-bar") {
        const randomColorWheel = getThemeColors().wheels.random;

        for (var i = 0; i < chartInputs.dimensions.length; i++) {
            chartModel.data.push(computeDiscreteDataSeries(processedData, chartInputs.independentColumn, chartInputs.dimensions[i]));
            chartModel.style.push({
                "color": randomColorWheel[i % randomColorWheel.length]
            });
        }
    } else if (chartInputs.type == "radar") {
        chartModel.data = computeRadarDataSeries(processedData, chartInputs.independentColumn, chartInputs.comparisonItems, chartInputs.dimensions);

        const radarChartColorWheel = getThemeColors().wheels.radar;
        for (var i = 0; i < chartInputs.comparisonItems.length; i++) {
            chartModel.style.push(radarChartColorWheel[i % radarChartColorWheel.length]);
        }
    } else if (chartInputs.type == "pie") {
        chartModel.data.push(computeDiscreteDataSeries(processedData, chartInputs.independentColumn, chartInputs.ySeries, chartInputs.options.isSorted, chartInputs.options.isNormalized));

        const randomColorWheel = getThemeColors().wheels.random;
        for (var i = 0; i < chartModel.data[0].y.length; i++) {
            chartModel.style.push({
                "color": randomColorWheel[i % randomColorWheel.length]
            });
        }
    } else {
        // Invalid chart type, just return the default chart model.
        return chartModel;
    }

    // Set the chart options.
    Object.assign(chartModel.options, chartInputs.options);
    chartModel.options["type"] = chartInputs.type;

    return chartModel;
}