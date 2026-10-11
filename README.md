# Kenya country briefing

Plain HTML, CSS, and JavaScript. No npm and no Python app.

## Files

- `briefing.html` — country briefing
- `index.html` — short economy page shell
- `assets/briefing.js` — sections, charts, map, World Bank fetch
- `assets/briefing.css`, `assets/styles.css`
- `data/country.json` — saved figures
- `data/kenya-counties.geojson` — county outlines

## View it

The page loads JSON, so open it through a local web server rather than by double-clicking the HTML file. From this folder, one option is:

```bash
python -m http.server 8000
```

Then open http://localhost:8000/briefing.html
