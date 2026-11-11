const test = require('node:test');
const assert = require('node:assert/strict');
const { rememberPlacement, placedBounds, validPlacement } = require('../lib/placement.cjs');
const primary = {id:1,workArea:{x:0,y:25,width:1920,height:1015}};
const left = {id:2,workArea:{x:-1280,y:0,width:1280,height:800}};
test('edge placement survives size changes, monitor removal and return',()=>{
  const saved=rememberPlacement({x:-204,y:718,width:204,height:82},left);
  assert.deepEqual(placedBounds(saved,[primary,left],primary,false),{x:-440,y:672,width:440,height:128});
  assert.deepEqual(placedBounds(saved,[primary],primary,false),{x:1480,y:912,width:440,height:128});
  assert.deepEqual(placedBounds(saved,[primary,left],primary,true),{x:-204,y:718,width:204,height:82});
});
test('offscreen dragging is clamped and corrupt preferences use visible defaults',()=>{
  const saved=rememberPlacement({x:-4000,y:9000,width:440,height:128},left);
  assert.deepEqual(placedBounds(saved,[left],left,false),{x:-1280,y:672,width:440,height:128});
  for(const value of [null,{}, {displayId:1,x:Infinity,y:0},{displayId:1,x:-1,y:0}]) assert.ok(!validPlacement(value));
  const tiny={id:3,workArea:{x:50,y:50,width:100,height:60}};
  const result=placedBounds(null,[tiny],tiny,false);
  assert.ok(result.x>=50 && result.y>=50 && result.x+result.width<=150 && result.y+result.height<=110);
});
