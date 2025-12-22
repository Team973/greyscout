
## Chart Data Schemas

BarChart, LineChart, ScatterChart:
```
color = ""
series = ""
labels = [x1, x2, ..., xn]
values = [y1, y2, ..., yn]
```

StackedBarChart:
```
colors = ["#COLOR", ...]

data = {
    "x1": [y11, y12, ..., y1m],
    "x2": [y21, y22, ..., y2m],
    ...
    "xn": [yn1, yn2, ..., ynm]
}
```

PieChart, DoughnutChart:
```
labels = [x1, x2, ..., xn]
values = [y1, y2, ..., yn]
```

RadarChart:
```
style = {
    "border": {
        "color": "#COLOR"
    },
    "background": {
        "color": "#COLOR"
    },
    "point": {
        "border": {
            "color": "#COLOR",
            "hoverColor": "#COLOR"
        },
        "background": {
            "color": "#COLOR",
            "hoverColor": "#COLOR"
        }
    }
}

labels = [x1, x2, ..., xn]
values = [y1, y2, ..., yn]
```


BoxPlot:
```
style = {
    "border": {
        "width": 3,
        "color": "#COLOR"
    },
    "sample": {
        "shape": "circle",
        "size": 2,
        "color": "#COLOR"
    }
}

labels = [x1, x2, ..., xn]
values = [
    [y11, y12, ..., y1m], 
    [y21, y22, ..., y2m], 
    ...,
    [yn1, yn2, ..., ynm]
]
```