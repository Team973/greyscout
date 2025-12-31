// @ts-nocheck

export function getTeamAnalysisLayout(teamNumber, eventId) {
    return [
        {
            type: "chart",
            title: "Team Performance",
            inputs: {
                "queryInputs": {
                    "type": "event_query",
                    "teamNumber": teamNumber,
                    "eventId": eventId,
                    "aggregationFn": "mean"
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
            title: "Match Scoring Breakdown",
            inputs: {
                "queryInputs": {
                    "type": "team_query",
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
            type: "chart",
            title: "Climb success rate",
            inputs: {
                "queryInputs": {
                    "type": "team_query",
                    "teamNumber": teamNumber,
                    "eventId": eventId,
                    "aggregationFn": "count"
                },
                "chartInputs": {
                    "type": "pie",
                    "independentColumn": "prematch_match_number",
                    "ySeries": "endgame_climb",
                    "xSeries": "auto_coral",
                    "dimensions": [],
                    "comparisonItems": [],
                    "options": {
                        "isSorted": false,
                        "isNormalized": true,
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
            title: "Match by Match Performance",
            inputs: {
                choices: [
                    { key: "auto_coral", text: "Auto Coral" },
                    { key: "teleop_coral", text: "Teleop Coral" }
                ],
                chartInputs: [
                    {
                        "queryInputs": {
                            "type": "team_query",
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
                            "type": "team_query",
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

