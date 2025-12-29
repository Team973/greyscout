// @ts-nocheck

import type { QueryInputs, ChartInputs } from "@/lib/chart-model"
import { mean } from "simple-statistics";

export function getTeamAnalysisLayout(teamNumber, eventId) {
    return [
        {
            type: "chart",
            inputs: {
                "queryInputs": {
                    "type": "event_rankings",
                    "teamNumber": teamNumber,
                    "eventId": eventId,
                    "aggregationFn": mean
                },
                "chartInputs": {
                    "type": "radar",
                    "independentColumn": "prematch_team_number",
                    "ySeries": "auto_coral",
                    "xSeries": "auto_coral",
                    "dimensions": [
                        "auto_coral",
                        "teleop_net",
                        "teleop_coral",
                        "endgame_climb",
                        "postmatch_defense"
                    ],
                    "comparisonItems": [
                        teamNumber
                    ],
                    "options": {
                        "isSorted": false,
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
            inputs: {
                "queryInputs": {
                    "type": "team_match_timeseries",
                    "teamNumber": teamNumber,
                    "eventId": eventId
                },
                "chartInputs": {
                    "type": "stacked-bar",
                    "independentColumn": "prematch_match_number",
                    "ySeries": "auto_coral",
                    "xSeries": "auto_coral",
                    "dimensions": [
                        "auto_coral",
                        "teleop_net",
                        "teleop_coral"
                    ],
                    "comparisonItems": [],
                    "options": {
                        "isSorted": false,
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
            type: "filterable-chart",
            inputs: {
                choices: [
                    { key: "auto_coral", text: "Auto Coral" },
                    { key: "teleop_coral", text: "Teleop Coral" }
                ],
                chartInputs: [
                    {
                        "queryInputs": {
                            "type": "team_match_timeseries",
                            "teamNumber": teamNumber,
                            "eventId": eventId
                        },
                        "chartInputs": {
                            "type": "bar",
                            "independentColumn": "prematch_match_number",
                            "ySeries": "auto_coral",
                            "xSeries": "auto_coral",
                            "dimensions": [],
                            "comparisonItems": [],
                            "options": {
                                "isSorted": false,
                                "isHorizontal": false,
                                "maxDataPoints": null,
                                "xRange": null,
                                "yRange": null,
                                "height": null,
                                "heightRatio": 0.5
                            }
                        }
                    },
                    {
                        "queryInputs": {
                            "type": "team_match_timeseries",
                            "teamNumber": teamNumber,
                            "eventId": eventId
                        },
                        "chartInputs": {
                            "type": "bar",
                            "independentColumn": "prematch_match_number",
                            "ySeries": "teleop_coral",
                            "xSeries": "teleop_coral",
                            "dimensions": [],
                            "comparisonItems": [],
                            "options": {
                                "isSorted": false,
                                "isHorizontal": false,
                                "maxDataPoints": null,
                                "xRange": null,
                                "yRange": null,
                                "height": null,
                                "heightRatio": 0.5
                            }
                        }
                    }
                ]
            }
        }
    ];
}

