'use client';
import dynamic from 'next/dynamic';
// import Chart from 'react-apexcharts';
const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

const PieChart = (props: any) => {
  const { chartData, chartOptions, type = 'pie' } = props;

  return (
    <Chart
      options={chartOptions}
      type={type}
      width="100%"
      height="100%"
      series={chartData}
    />
  );
};

export default PieChart;
