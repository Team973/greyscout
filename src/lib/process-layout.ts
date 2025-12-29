// TODO: fix types
// @ts-nocheck

import { getChartModel } from "@/lib/chart-model";

export async function processLayout(tileLayout) {
    let tileModels = [];
    for (var i = 0; i < tileLayout.length; i++) {
        const input = tileLayout[i].inputs;
        const type = tileLayout[i].type;

        let tileModel = {};
        if (type == "chart") {
            tileModel = await getChartModel(input.queryInputs, input.chartInputs);
        } else if (type == "filterable-chart") {
            tileModel['choices'] = input.choices;
            tileModel['models'] = [];
            for (var i = 0; i < input.chartInputs.length; i++) {
                tileModel.models.push(await getChartModel(input.chartInputs[i].queryInputs, input.chartInputs[i].chartInputs));
            }
        }

        tileModels.push({
            type: type,
            model: tileModel
        });
    }

    return tileModels;
} 