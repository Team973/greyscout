// TODO: fix types
// @ts-nocheck


import { computeDiscreteDataSeries, computeCartesianDataSeries, computeSampledDataSeries, computeRadarDataSeries } from "@/lib/chart-data";
import { queryTeamMatchData, queryEventData } from "@/lib/data-query";

import { aggregateData } from "@/lib/data-transforms";
import { randomColorWheel, radarChartColorWheel } from '@/lib/theme';

export type ChartOptions = {
    isSorted: Boolean,
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

    aggregationFn: Function
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
    if (queryInputs.type == "team_match_timeseries") {
        dbData = await queryTeamMatchData(queryInputs.teamNumber, queryInputs.eventId);
    } else if (queryInputs.type == "event_rankings") {
        dbData = await queryEventData(queryInputs.eventId);
    }

    if (!dbData) {
        return chartModel;
    }

    // Perform data aggregation when in certain modes.
    if (queryInputs.type == "event_rankings" && chartInputs.type != "boxplot") {
        dbData = aggregateData(dbData, chartInputs.independentColumn, queryInputs.aggregationFn);
    }

    // Compute the chart data series.
    if (chartInputs.type == "bar" || chartInputs.type == "line") {
        chartModel.data.push(computeDiscreteDataSeries(dbData, chartInputs.independentColumn, chartInputs.ySeries, chartInputs.options.isSorted));
    } else if (chartInputs.type == "scatter") {
        chartModel.data.push(computeCartesianDataSeries(dbData, chartInputs.xSeries, chartInputs.ySeries, chartInputs.independentColumn))
    } else if (chartInputs.type == "boxplot") {
        chartModel.data = computeSampledDataSeries(dbData, chartInputs.independentColumn, chartInputs.ySeries, chartInputs.options.isSorted);
    } else if (chartInputs.type == "stacked-bar") {
        for (var i = 0; i < chartInputs.dimensions.length; i++) {
            chartModel.data.push(computeDiscreteDataSeries(dbData, chartInputs.independentColumn, chartInputs.dimensions[i]));
            chartModel.style.push({
                "color": randomColorWheel[i % randomColorWheel.length]
            });
        }
    } else if (chartInputs.type == "radar") {
        chartModel.data = computeRadarDataSeries(dbData, chartInputs.independentColumn, chartInputs.comparisonItems, chartInputs.dimensions);

        for (var i = 0; i < chartInputs.comparisonItems.length; i++) {
            chartModel.style.push(radarChartColorWheel[i % radarChartColorWheel.length]);
        }
    }

    // Set the chart options.
    Object.assign(chartModel.options, chartInputs.options);
    chartModel.options["type"] = chartInputs.type;

    return chartModel;
}