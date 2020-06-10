import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { MapOptions, FieldBuffer } from 'types';
import L, { Map, TileLayer, /*  CircleMarker, */ FeatureGroup, Polyline } from 'leaflet';
// import { point, featureCollection, Point, Feature } from '@turf/helpers';
// import nearestPoint, { NearestPoint } from '@turf/nearest-point';
import { nanoid } from 'nanoid';
// import PathFinder from 'geojson-path-finder';
import Person from './img/person.svg';
import { processReceivedData } from './util/helpFunc';
import 'leaflet.motion/dist/leaflet.motion.min.js';
import 'leaflet/dist/leaflet.css';

interface Props extends PanelProps<MapOptions> {}
interface State {
  options: string[];
  current: string;
}

export class MainPanel extends PureComponent<Props> {
  id = 'id' + nanoid();
  map: Map;
  randomTile: TileLayer;
  perUserRoute: { [key: string]: [number, number][] };
  perUserVendorName: { [key: string]: string };
  route: TileLayer;
  closestPoints: FeatureGroup;
  topologyLine: Polyline;

  state: State = {
    options: [],
    current: 'None',
  };

  componentDidMount() {
    const { center_lat, center_lon, zoom_level, max_zoom, tile_url } = this.props.options;

    const openStreetMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxNativeZoom: 19,
      maxZoom: max_zoom,
    });

    this.map = L.map(this.id, {
      layers: [openStreetMap],
    }).setView([center_lat, center_lon], zoom_level);

    if (tile_url !== '') {
      this.randomTile = L.tileLayer(tile_url, {
        maxZoom: this.props.options.max_zoom,
      });
      this.map.addLayer(this.randomTile);
    }
    if (this.props.data.series.length > 0) {
      const fields = this.props.data.series[0].fields as FieldBuffer[];
      if (fields[2].values.buffer.length !== 0) {
        const { perUserRoute, perUserVendorName } = processReceivedData(this.props.data.series[0].length, fields);

        this.perUserRoute = perUserRoute;
        this.perUserVendorName = perUserVendorName;

        console.log('motion ', this.perUserRoute);
        this.setState({
          options: Object.keys(this.perUserRoute),
        });
      }
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.data.series[0] !== this.props.data.series[0]) {
      if (this.props.data.series.length == 0) {
        this.route && this.map.removeLayer(this.route);
        this.topologyLine && this.map.removeLayer(this.topologyLine);
        this.setState({
          options: [],
          current: 'None',
        });
        return;
      }

      const newFields = this.props.data.series[0].fields as FieldBuffer[];

      if (newFields[1].values.buffer.length !== 0) {
        const { perUserRoute, perUserVendorName } = processReceivedData(this.props.data.series[0].length, newFields);

        this.perUserRoute = perUserRoute;
        this.perUserVendorName = perUserVendorName;

        this.setState({ options: Object.keys(this.perUserRoute) });
      } else {
        this.route && this.map.removeLayer(this.route);

        this.setState({
          options: [],
          current: 'None',
        });
      }
    }

    if (prevProps.options.tile_url !== this.props.options.tile_url) {
      this.randomTile && this.map.removeLayer(this.randomTile);

      if (this.props.options.tile_url !== '') {
        this.randomTile = L.tileLayer(this.props.options.tile_url, {
          maxZoom: this.props.options.max_zoom,
        });
        this.map.addLayer(this.randomTile);
      }
    }

    if (prevProps.options.center_lat !== this.props.options.center_lat || prevProps.options.center_lon !== this.props.options.center_lon) {
      this.map.flyTo([this.props.options.center_lat, this.props.options.center_lon]);
    }

    if (prevProps.options.zoom_level !== this.props.options.zoom_level && this.props.options.zoom_level <= this.props.options.max_zoom) {
      this.map.setZoom(this.props.options.zoom_level);
    }

    if (prevProps.options.max_zoom !== this.props.options.max_zoom && this.props.options.max_zoom >= this.props.options.zoom_level) {
      this.map.setMaxZoom(this.props.options.max_zoom);
    }

    if (prevState.current !== this.state.current) {
      this.route && this.map.removeLayer(this.route);
      this.closestPoints && this.map.removeLayer(this.closestPoints);
      this.topologyLine && this.map.removeLayer(this.topologyLine);
      if (this.state.current !== 'None') {
        const routeData = this.perUserRoute[this.state.current];
        console.log('current ', routeData);
        if (routeData.length > 1) {
          // @ts-ignore
          this.topologyLine = L.motion
            // @ts-ignore
            .polyline(
              routeData,
              {
                color: 'yellow',
              },
              {
                auto: true,
                duration: 200 * routeData.length,
                // @ts-ignore
                easing: L.Motion.Ease.linear,
              },
              {
                removeOnEnd: true,
                showMarker: true,
                icon: L.icon({
                  iconUrl: Person,
                  iconSize: [30, 30],
                }),
              }
            )
            .addTo(this.map);
        }
      }

      /*       this.route && this.map.removeLayer(this.route);
      this.closestPoints && this.map.removeLayer(this.closestPoints);
      this.topologyLine && this.map.removeLayer(this.topologyLine);

      if (this.state.current !== 'None') {
        const routeData = this.perUserRoute[this.state.current];

        if (this.props.options.topology) {
          const closestData: NearestPoint[] = [];
          const nodes = this.props.options.topology.features.filter(element => element.geometry.type == 'Point');
          const topologyNodes = featureCollection<Point>(nodes as Feature<Point>[]);

          routeData.map(coord => {
            closestData.push(nearestPoint(point(coord), topologyNodes));
          });

          const closestMarkers: CircleMarker[] = [];
          closestData.map(el => {
            closestMarkers.push(
              L.circleMarker(el.geometry.coordinates as [number, number], {
                color: 'red',
                radius: 4,
              })
            );
          });

          this.closestPoints = L.featureGroup(closestMarkers).addTo(this.map);

          const pathFinder = new PathFinder(this.props.options.topology);

          if (closestData.length > 1) {
            const pathFinding: [number, number][] = [];
            const first_path = pathFinder.findPath(closestData[0], closestData[1]);

            pathFinding.push(...(first_path || { path: [] }).path);
            for (let i = 1; i < closestData.length - 1; i++) {
              const pathResult = (
                pathFinder.findPath(closestData[i], closestData[i + 1]) || {
                  path: [],
                }
              ).path;

              if (pathResult.length == 1) {
                pathFinding.push(pathResult[0]);
              } else if (pathResult.length > 1) {
                pathFinding.push(...pathResult.slice(1));
              }
            }

            if (pathFinding.length > 1) {
              // @ts-ignore
              this.topologyLine = L.motion
                // @ts-ignore
                .polyline(
                  pathFinding,
                  {
                    color: 'yellow',
                  },
                  {
                    auto: true,
                    duration: 500 * pathFinding.length,
                    // @ts-ignore
                    easing: L.Motion.Ease.linear,
                  },
                  {
                    removeOnEnd: true,
                    showMarker: true,
                    icon: L.icon({
                      iconUrl: Person,
                      iconSize: [30, 30],
                    }),
                  }
                )
                .addTo(this.map);
            }
          } 
        }*/
    }
  }

  handleSelector = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ current: e.target.value });
  };

  render() {
    const { width, height } = this.props;
    const { options, current } = this.state;

    return (
      <div
        style={{
          width,
          height,
        }}
      >
        <select id="selector" onChange={this.handleSelector} value={current} style={{ width: 500, marginBottom: 5 }}>
          <option value="None">None</option>
          {options.map(item => (
            <option key={item} value={item}>
              {`${item.slice(0, 8)} - ${this.perUserVendorName[item]}`}
            </option>
          ))}
        </select>
        <div
          id={this.id}
          style={{
            width,
            height: height - 40,
          }}
        ></div>
      </div>
    );
  }
}
