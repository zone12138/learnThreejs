<template>
  <div ref="heatmapContainer" class="heatmap-container"></div>
</template>

<script setup>
import h337 from 'heatmap.js'
import { ref, onMounted } from 'vue'

const heatmapContainer = ref(null)

onMounted(() => {
  // 确保容器存在
  if (!heatmapContainer.value) {
    console.error('热力图容器未找到')
    return
  }

  const heatmap = h337.create({
    container: heatmapContainer.value,
    radius: 25,
    maxOpacity: 0.5,
    minOpacity: 0,
    blur: 0.75,
    gradient: {
      0.5: '#1fc2e1',
      0.6: '#24d560',
      0.7: '#9cd522',
      0.8: '#f1e12a',
      0.9: '#ffbf3a',
      1.0: '#ff0000',
    },
  })

  // 使用正确的数据格式
  heatmap.setData({
    max: 10,
    min: 0,
    data: [
      { x: 50, y: 100, value: 5 },
      { x: 150, y: 200, value: 10 },
      { x: 250, y: 300, value: 8 },
      { x: 300, y: 150, value: 7 },
      { x: 400, y: 250, value: 9 },
      { x: 450, y: 350, value: 6 },
      { x: 500, y: 400, value: 10 },
      { x: 600, y: 300, value: 8 },
    ],
  })

  console.log('热力图创建成功:', heatmap)
})
</script>

<style scoped>
.heatmap-container {
  width: 800px;
  height: 600px;
  background-color: #f5f5f5;
}
</style>
