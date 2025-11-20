// components/score-radar-chart/score-radar-chart.js
const echarts = require('../../miniprogram_npm/echarts/index')

Component({
  properties: {
    scores: {
      type: Object,
      value: {
        contentScore: 0,
        languageScore: 0,
        structureScore: 0
      },
      observer: 'updateChart'
    }
  },

  data: {
    ec: {
      onInit: null
    }
  },

  lifetimes: {
    attached() {
      this.initChart()
    },

    detached() {
      if (this.chart) {
        this.chart.dispose()
      }
    }
  },

  methods: {
    initChart() {
      this.setData({
        ec: {
          onInit: this.initChartCanvas.bind(this)
        }
      })
    },

    initChartCanvas(canvas, width, height, dpr) {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      })
      
      canvas.setChart(chart)
      this.chart = chart
      
      // 延迟更新图表，确保数据已就绪
      setTimeout(() => {
        this.updateChart()
      }, 100)
      
      return chart
    },

    updateChart() {
      if (!this.chart) {
        console.log('雷达图: chart未初始化')
        return
      }
      
      const scores = this.data.scores || {}
      const { contentScore = 0, languageScore = 0, structureScore = 0 } = scores
      
      console.log('雷达图更新数据:', { contentScore, languageScore, structureScore })
      
      const option = {
        color: ['#4F7FE8'],
        radar: {
          indicator: [
            { name: '内容', max: 10 },
            { name: '语言', max: 10 },
            { name: '结构', max: 10 }
          ],
          center: ['50%', '55%'],
          radius: '65%',
          splitNumber: 5,
          shape: 'polygon',
          name: {
            textStyle: {
              color: '#4F7FE8',
              fontSize: 12,
              fontWeight: 600
            }
          },
          splitLine: {
            lineStyle: {
              color: '#E5E7EB',
              width: 1
            }
          },
          splitArea: {
            show: true,
            areaStyle: {
              color: ['rgba(79, 127, 232, 0.05)', 'rgba(255, 255, 255, 0.9)']
            }
          },
          axisLine: {
            lineStyle: {
              color: '#E5E7EB'
            }
          }
        },
        series: [{
          type: 'radar',
          symbol: 'circle',
          symbolSize: 6,
          data: [{
            value: [contentScore, languageScore, structureScore],
            name: '本次得分',
            itemStyle: {
              color: '#4F7FE8',
              borderWidth: 2,
              borderColor: '#FFFFFF'
            },
            lineStyle: {
              color: '#4F7FE8',
              width: 2
            },
            areaStyle: {
              color: 'rgba(79, 127, 232, 0.25)'
            }
          }]
        }]
      }
      
      this.chart.setOption(option)
    }
  }
})

