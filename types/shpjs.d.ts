// Type stub for shpjs (no official @types package)
declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson'

  type ShpResult = FeatureCollection | FeatureCollection[]

  function shpjs(data: ArrayBuffer | string): Promise<ShpResult>
  namespace shpjs {
    function parseShp(buf: ArrayBuffer | Buffer): number[][]
    function parseDbf(buf: ArrayBuffer | Buffer): Record<string, unknown>[]
    function combine([shp, dbf]: [number[][], Record<string, unknown>[]]): FeatureCollection
  }
  export = shpjs
}

