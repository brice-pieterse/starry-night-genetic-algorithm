import * as PIXI from "https://cdn.skypack.dev/pixi.js@6.2.1";

const resolution = window.devicePixelRatio || 1

let pixiHero = document.querySelector('.pixi-wrapper')
let target = []
let height = window.innerHeight
let width = window.innerWidth
let cols;
let rows;
let textureCount = 0
let splotchSize = 30
let mutationRate
let popmax
let population
let scoreRatioScalar = 25


//let added = 0

const app = new PIXI.Application({
  width: width,
  height: height,
  resolution: resolution,
  antialias: true,
  autoDensity: true,
  backgroundColor: 0x000000
}) 

pixiHero.appendChild(app.view)

function createTarget(resolve, reject){
  // loads van gogh
  // creates target: a 3d array of rgb values
  // [row[col[r,g,b]]]
  
  const loader = new PIXI.Loader()
  
  loader.add('gogh', 'https://assets.codepen.io/5281462/gogh.jpeg')
  
  loader.load((loader, resources) => {
    
    let van = resources.gogh.texture
    
    van.baseTexture.setSize(width, height, resolution)
   

    cols = Math.floor(van.baseTexture.width/splotchSize)
    rows = Math.floor(van.baseTexture.height/splotchSize) 
    
    let t = []

    for (let r = 0; r < rows; r++){

      let row = []

      for (let c = 0; c < cols; c++){

        let textureX = c * splotchSize
        let textureY = r * splotchSize

        let texture = new PIXI.Texture(van.baseTexture, new PIXI.Rectangle(textureX, textureY, splotchSize, splotchSize), van.orig, van.trim)


        let sprite = new PIXI.Sprite.from(texture)

        let pixel = getAvgPixel(sprite)
        row.push(pixel)
      }
      t.push(row)
    }
    resolve(t)
    
  })
  
}


function getAvgPixel(sprite){

  let pixels = app.renderer.plugins.extract.pixels(sprite)
  
  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  let current = 'red'
  let avgRed = 0
  let avgGreen = 0
  let avgBlue = 0
  for (let val of pixels){
    if (current == 'red'){
      red+=val
      count++
      current = 'green'
    }
    else if (current == 'green'){
      green+=val
      count++
      current = 'blue'
    }
    else if (current == 'blue') {
      blue+=val
      count++
      current = 'alpha'
    }
    else if (current == 'alpha'){
      current = 'red'
    }
  }
  avgRed = Math.round(red/count)
  avgGreen = Math.round(green/count)
  avgBlue = Math.round(blue/count)
  

  return [avgRed, avgGreen, avgBlue]
}


function setup() {
  
  const loadVanGogh = new Promise(createTarget);
  
  loadVanGogh.then((t) => {
    target = t
    console.log(target)

    //testTargetPixel();
    popmax = 100;
    mutationRate = 0.01;


    population = new Population(target, mutationRate, popmax);


    app.ticker.add(() => {
      if (population.isFinished()) {
        app.ticker.stop();
      }
      else {
        draw()
      }
    })
  })
  
}


function draw() {
  // Generate mating pool
  population.naturalSelection();
  //Create next generation
  population.generate();
  // Calculate fitness
  population.calcFitness();
  // Compute the current "most fit" member of the population
  population.evaluate();

  // display best, stats
  renderBest();

}


class Population {
  constructor(t, m, p){
    this.matingPool = []
    this.generations = 0
    this.finished = false
    this.target = target
    this.mutationRate = m
    this.perfectScore = 1
    this.best;
    this.population = []
    for (let i = 0; i < p; i++){
      this.population.push(new Painting())
    }
    this.calcFitness()
  }
  
  naturalSelection(){

    let maxFitness = 0
    for (let i = 0; i < this.population.length; i++){
      if (this.population[i].fitness > maxFitness){

        maxFitness = this.population[i].fitness
      }
    }
    
    maxFitness = Math.pow(maxFitness, scoreRatioScalar)
    
    for (var i = 0; i < this.population.length; i++) {
      
      let fitness = Math.pow(this.population[i].fitness, scoreRatioScalar)

      const scaledRatio = fitness/maxFitness
      
      const n = Math.floor(scaledRatio * 100);
      for (var j = 0; j < n; j++) { 
        this.matingPool.push(this.population[i]);
      }
    }
    
  }
  
  generate(){
    // create new gen from mating pool

    for (let i = 0; i < this.population.length; i++){
     
      const a = getRandom(0, this.matingPool.length-1)
      const b = getRandom(0, this.matingPool.length-1)
      const partnerA = this.matingPool[a]
      const partnerB = this.matingPool[b]

      const child = partnerA.crossover(partnerB)
      child.mutate(this.mutationRate)
      this.population[i] = child
    }
    this.generations++
  }
  
  calcFitness(){
    for (let i = 0; i < this.population.length; i++){
      this.population[i].calcFitness(target);
  
    }
  }
  
  evaluate(){
    let worldrecord = 0
    let index = 0
    for (let i = 0; i < this.population.length; i++){
      if (this.population[i].fitness > worldrecord){
        index = i
        worldrecord = this.population[i].fitness
      }
    }

    this.best = this.population[index].genes
    if (worldrecord >= 0.99){
      this.finished = true
    }
  }
  
  isFinished(){
    return this.finished
  }
  
  getGenerations(){
    return this.generations
  }
  
}


class Painting {
  
  constructor(){
    this.genes = []
    this.fitness = 0
    
    for (let r = 0; r < rows; r++){
      let row = []
      for (let c = 0; c < cols; c++){
        const r = getRandom(0, 255)
        const g = getRandom(0, 255)
        const b = getRandom(0, 255)
        row.push([r, g, b])
      }
      this.genes.push(row)
    }
  }
  
  calcFitness(target){
    let score = 0
    let count = 0
    let percentages = 0
    for (let r = 0; r < target.length; r++){
      for (let c = 0; c < target[r].length; c++){
        let targetRed = target[r][c][0]
        let targetGreen = target[r][c][1]
        let targetBlue = target[r][c][2]
        let thisRed = this.genes[r][c][0]
        let thisGreen = this.genes[r][c][1]
        let thisBlue = this.genes[r][c][2]
        

        let redMatch = (targetRed > thisRed) ? thisRed/targetRed : targetRed/thisRed
        let greenMatch = (targetGreen > thisGreen) ? thisGreen/targetGreen : targetGreen/thisGreen
        let blueMatch = (targetBlue > thisBlue) ? thisBlue/targetBlue : targetBlue/thisBlue
        
        let matchScore = (redMatch + greenMatch + blueMatch)/3
                
        count++
        percentages += matchScore
      }
    }
    score = percentages/count
    this.fitness = score
  }
  
  crossover(partner){
    const child = new Painting()
    const randMidPoint = Math.floor(Math.random() * this.genes.length)
    // half from one, half from the other
    for (let r = 0; r < this.genes.length; r++){
      for (let c = 0; c < this.genes[r].length; c++){
        for (let rgb = 0; rgb < this.genes[r][c].length; rgb++){
          if (closestMatch(this.genes[r][c][rgb], partner.genes[r][c][rgb], target[r][c][rgb]) === 'a'){
            child.genes[r][c][rgb] = this.genes[r][c][rgb]
          }
          else {
            child.genes[r][c][rgb] = partner.genes[r][c][rgb]
          }
        }
      }
      
    }
    
    return child
  }
  
  mutate(mutationRate){
    // mutate based on probability
    for (let r = 0; r < this.genes.length; r++){
      for (let c = 0; c < this.genes[r].length; c++){
        if (Math.random() < mutationRate){
          let which = getRandom(0,2)
          this.genes[r][c][which] = getRandom(0, 255)
        }
      }
    }
  }
  
}
  

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }


function renderBest(){
  // clear current stage
  app.stage.removeChildren()
  // render new best
  const bestTextures = population.best
  //console.log(bestTextures)
  for (let r = 0; r < bestTextures.length; r++){
    for (let c = 0; c < bestTextures[r].length; c++){
      const rgb = bestTextures[r][c]
      let hex = rgbToHex(rgb[0], rgb[1], rgb[2])
      let pixel = new PIXI.Graphics().beginFill(hex).drawRect(c * splotchSize, r * splotchSize, splotchSize, splotchSize).endFill()
      app.stage.addChild(pixel)
    }
  }
}

function closestMatch(a, b, c){
  let firstDiff = Math.abs(c - a)
  let secondDiff = Math.abs(c - b)
  if (firstDiff < secondDiff){
    return 'a'
  }
  else return 'b'
}

setup()



function testTargetPixel(){
  const rgb = target[7][30]
  console.log("rgb", rgb)
  let hex = rgbToHex(rgb[0], rgb[1], rgb[2])
  // PROBLEM HEX VALUE MIGHT BE ATTACHING INCORRECTLY, THIS SHOULD BE BROWN BUT IS BLACK..... REMOVE THE # and put infront of 0 as a number
  console.log("hex", hex)
  let pixel = new PIXI.Graphics().beginFill(hex).drawRect(0 * splotchSize, 0 * splotchSize, splotchSize, splotchSize).endFill()
  app.stage.addChild(pixel) 
  pixel.width = splotchSize
  pixel.height = splotchSize
  pixel.x = 0 * splotchSize
  pixel.y = 0 * splotchSize
}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return '0x' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}