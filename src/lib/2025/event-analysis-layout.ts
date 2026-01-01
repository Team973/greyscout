// @ts-nocheck

import type { QueryInputs, ChartInputs } from "@/lib/chart-model"
import { mean } from "simple-statistics";

export function getEventAnalysisLayout(eventId) {
    return [
        {
            type: "chart",
            title: "Teleop Coral Averages",
            inputs: {
                "queryInputs": {
                    "type": "event_query",
                    "teamNumber": null,
                    "eventId": eventId,
                },
                "chartInputs": {
                    "type": "boxplot",
                    "independentColumn": "prematch_team_number",
                    "ySeries": "teleop_coral",
                    "xSeries": "teleop_coral",
                    "dimensions": [],
                    "comparisonItems": [],
                    "options": {
                        "isSorted": true,
                        "isHorizontal": false,
                        "maxDataPoints": null,
                        "xRange": null,
                        "yRange": null,
                        "height": null,
                        "heightRatio": 0.5
                    }
                }
            }
        },
        {
            type: "chart",
            title: "Auto Coral Averages",
            inputs: {
                "queryInputs": {
                    "type": "event_query",
                    "teamNumber": null,
                    "eventId": eventId,
                },
                "chartInputs": {
                    "type": "boxplot",
                    "independentColumn": "prematch_team_number",
                    "ySeries": "auto_coral",
                    "xSeries": "auto_coral",
                    "dimensions": [],
                    "comparisonItems": [],
                    "options": {
                        "isSorted": true,
                        "isHorizontal": false,
                        "maxDataPoints": null,
                        "xRange": null,
                        "yRange": null,
                        "height": null,
                        "heightRatio": 0.5
                    }
                }
            }
        },
        {
            type: "chart",
            title: "Algae Scoring",
            inputs: {
                "queryInputs": {
                    "type": "event_query",
                    "teamNumber": null,
                    "eventId": eventId,
                    "aggregationFn": "mean"
                },
                "chartInputs": {
                    "type": "scatter",
                    "independentColumn": "prematch_team_number",
                    "ySeries": "teleop_net",
                    "xSeries": "teleop_processor",
                    "dimensions": [],
                    "comparisonItems": [],
                    "options": {
                        "isSorted": false,
                        "isNormalized": false,
                        "isHorizontal": false,
                        "maxDataPoints": null,
                        "xRange": null,
                        "yRange": null,
                        "height": null,
                        "heightRatio": 0.5
                    }
                }
            }
        }
    ];
}

