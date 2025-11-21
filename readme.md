# Team 973 GreyScout

## Installation

1. Clone the repo
2. Install all npm dependencies: 
```bash
npm install
```
3. (optional) Install all python util dependencies:
```bash
cd util
poetry install
```

## Development 

To start the website in development mode:
```bash
npm run dev
```

To format the code:
```bash
npm run format
```

To update the event/team database:
```bash
cd util
poetry run python main.py
```

## Running in Production

To start in production mode:
```bash
npm start
```
