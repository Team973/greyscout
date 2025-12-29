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
                    "type": "event_rankings",
                    "teamNumber": null,
                    "eventId": eventId,
                    "aggregationFn": mean
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
                        "heightRatio": 0.75
                    }
                }
            }
        },
        {
            type: "chart",
            title: "Auto Coral Averages",
            inputs: {
                "queryInputs": {
                    "type": "event_rankings",
                    "teamNumber": null,
                    "eventId": eventId,
                    "aggregationFn": mean
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
                        "heightRatio": 0.75
                    }
                }
            }
        }
    ];
}

