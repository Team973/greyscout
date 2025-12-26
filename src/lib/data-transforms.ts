// TODO: fix types
// @ts-nocheck

export function aggregateData(data, groupByColumnName, fn) {
    let dependentColumns = Object.keys(data[0]);
    const groupByColumnIndex = dependentColumns.indexOf(groupByColumnName);
    if (groupByColumnIndex > -1) {
        dependentColumns.splice(groupByColumnIndex, 1);
    }

    let resultDict = {};
    for (var i = 0; i < data.length; i++) {
        const row = data[i];
        const key = row[groupByColumnName];

        if (!Object.keys(resultDict).includes(key)) {
            resultDict[key] = {};
        }

        dependentColumns.forEach(col => {
            const val = row[col];

            if (!Object.keys(resultDict[key]).includes(col)) {
                resultDict[key][col] = [val]
            } else {
                resultDict[key][col].push(val);
            }
        });
    }

    let resultData = [];
    Object.keys(resultDict).forEach(key => {
        let groupedData = {};
        groupedData[groupByColumnName] = key;

        const entry = resultDict[key];
        // console.log(entry)
        dependentColumns.forEach(col => {
            var aggregatedValues = fn(entry[col])
            groupedData[col] = aggregatedValues;
        });

        resultData.push(groupedData);
    });

    return resultData;
}