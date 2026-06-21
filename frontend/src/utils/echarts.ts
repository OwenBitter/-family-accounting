/** Tree-shaken ECharts setup — register only used components */
import { init, getInstanceByDom, use } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([
  BarChart,
  LineChart,
  PieChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
]);

// Re-export the registered echarts object for use as echarts prop
export { init, getInstanceByDom };
export default { init, getInstanceByDom };
