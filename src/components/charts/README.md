
## Chart Data Schemas

BarChart, LineChart:
```
color = ""
data = [
    {
        name: "",
        labels: [l1, l2, ..., ln],
        y: [y1, y2, ..., yn]
    }
]

```

ScatterChart:
```
color = ""
data = [
    {
        name: "",
        labels: [l1, l2, ..., ln],
        x: [x1, x2, ..., xn],
        y: [y1, y2, ..., yn]
    }
]

```

StackedBarChart:
```
colors = ["#COLOR", ...]

data = [
    {
        series: "",
        labels: [l1, l2, ..., ln],
        y: [y1, y2, ..., yn]
    },
    ...
    {
        series: "",
        labels: [l1, l2, ..., ln],
        y: [y1, y2, ..., yn]
    }
]
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