/**
 * @module WebGPU
 * @description WebGPU Compute.
 *
 * @author [Andrej Hristoliubov]{@link https://anhr.github.io/AboutMe/}
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.WebGPU = {})));
}(this, (function (exports) { 'use strict';

/**
 * @module WebGPU
 * @description [WebGPU]{@link https://gpuweb.github.io/gpuweb/}. GPU Compute on the web.
 * @see [Get started with GPU Compute on the web]{@link https://web.dev/gpu-compute/}
 *
 * @author [Andrej Hristoliubov]{@link https://github.com/anhr}
 *
 * @copyright 2011 Data Arts Team, Google Creative Lab
 *
 * @license under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
*/
class WebGPU {
	constructor(settings) {
		let gpuDevice = null;
		async function initializeWebGPU() {
			if (!WebGPU.isSupportWebGPU()) {
				console.error("WebGPU: User agent doesn't support WebGPU. WebGPU is available for now in Chrome Canary https://www.google.com/intl/ru/chrome/canary/ on desktop behind an experimental flag. You can enable it at chrome://flags/#enable-unsafe-webgpu. The API is constantly changing and currently unsafe. As GPU sandboxing isn't implemented yet for the WebGPU API, it is possible to read GPU data for other processes! Don't browse the web with it enabled.");
				return;
			}
			const gpuAdapter = await navigator.gpu.requestAdapter();
			if (!gpuAdapter) {
				console.error('No WebGPU adapters found.');
				return false;
			}
			gpuDevice = await gpuAdapter.requestDevice();
			gpuDevice.lost.then(info => {
				console.error(`WebGPU device was lost: ${info.message}`);
				gpuDevice = null;
				if (info.reason != 'destroyed') {
					initializeWebGPU();
				}
			});
			onWebGPUInitialized();
		}
		function onWebGPUInitialized() {
			const input = settings.input;
			let bindGroupLayout, bindGroup;
			const phase = { param: 0, max: 0 };
			if (input) {
				if (input.matrices) input.matrices.forEach(inputMatrix => {
					const matrix = [inputMatrix.length,
					inputMatrix[0].length];
					inputMatrix.forEach(row => row.forEach(value => matrix.push(value)));
					inputMatrix.matrix = new Float32Array(matrix);
					inputMatrix.gpuBuffer = gpuDevice.createBuffer({
						mappedAtCreation: true,
						size: inputMatrix.matrix.byteLength,
						usage: GPUBufferUsage.STORAGE
					});
					new Float32Array(inputMatrix.gpuBuffer.getMappedRange()).set(inputMatrix.matrix);
					inputMatrix.gpuBuffer.unmap();
				});
				if (input.params) {
					function writeBuffer(item, type) {
						let paramBufferSize = 0;
						const data = [];
						Object.keys(item).forEach(key => {
							let param = item[key];
							if (typeof param === "number") {
								function isInt(n) {
									return n % 1 === 0;
								}
								const isInteger = isInt(param);
								if (!isInteger && type === Uint32Array) {
									console.error('WebGPU: Invalid ' + key + ' = ' + param + ' parameter type. ' + (type === Uint32Array ? 'Integer' : 'Float') + ' is allowed only.');
									return;
								}
								paramBufferSize += type.BYTES_PER_ELEMENT;
								data.push(param);
							} else console.error('WebGPU: Invalid param: ' + param);
						});
						item.paramBuffer = gpuDevice.createBuffer({
							size: paramBufferSize,
							usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
						});
						gpuDevice.queue.writeBuffer(item.paramBuffer, 0, new type(data));
						item.data = data;
					}
					Object.keys(input.params).forEach(key => {
						switch (key) {
							case 'f32':
								writeBuffer(input.params[key], Float32Array);break;
							case 'u32':
								writeBuffer(input.params[key], Uint32Array);break;
							default:
								console.error('WebGPU: Invalid input.params "' + key + '" key.');
						}
					});
				}
			}
			settings.results.forEach((result, i) => {
				if (!result.out) console.error('WebGPU: settings.results[' + i + '].out is undefined.');else if (result.phase !== undefined && result.phase > phase.max) phase.max = result.phase;
			});
			if (phase.max > 0) {
				phase.paramBuffer = gpuDevice.createBuffer({
					size: Uint32Array.BYTES_PER_ELEMENT,
					usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
				});
				gpuDevice.queue.writeBuffer(phase.paramBuffer, 0, new Uint32Array([phase.param]));
			}
			if (settings.results) settings.results.forEach(resultMatrix => {
				if (resultMatrix.type === undefined) resultMatrix.type = Float32Array;
				const bufferSize = resultMatrix.type.BYTES_PER_ELEMENT * resultMatrix.count;
				if (!bufferSize) {
					console.error('WebGPU: "count" key is not defined in the settings.results item.');
					return;
				}
				if (gpuDevice.limits.maxBufferSize < bufferSize) {
					console.error('WebGPU: GPUDevice buffer size = ' + bufferSize + ' is limited to ' + gpuDevice.limits.maxBufferSize);
					return;
				}
				resultMatrix.buffer = gpuDevice.createBuffer({
					size: bufferSize,
					usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
				});
			});
			const entriesBindGroupLayout = [],
			      entriesBindGroup = [];
			let binding = 0;
			if (input) {
				if (input.matrices) for (var i = 0; i < input.matrices.length; i++) {
					entriesBindGroupLayout.push({
						binding: binding,
						visibility: GPUShaderStage.COMPUTE,
						buffer: { type: "read-only-storage" }
					});
					entriesBindGroup.push({
						binding: binding,
						resource: { buffer: input.matrices[i].gpuBuffer }
					});
					binding++;
				}
				if (input.params) {
					Object.keys(input.params).forEach(key => {
						switch (key) {
							case 'f32':
							case 'u32':
								entriesBindGroupLayout.push({
									binding: binding,
									visibility: GPUShaderStage.COMPUTE,
									buffer: { type: "uniform" }
								});
								entriesBindGroup.push({
									binding: binding,
									resource: { buffer: input.params[key].paramBuffer }
								});
								binding++;
								break;
							default:
								console.error('WebGPU: Invalid input.params "' + key + '" key.');
						}
					});
				}
			}
			if (settings.results) settings.results.forEach(resultMatrix => {
				entriesBindGroupLayout.push({
					binding: binding,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "storage" }
				});
				entriesBindGroup.push({
					binding: binding,
					resource: { buffer: resultMatrix.buffer }
				});
				binding++;
			});
			if (phase.max > 0) {
				entriesBindGroupLayout.push({
					binding: binding,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				});
				entriesBindGroup.push({
					binding: binding,
					resource: { buffer: phase.paramBuffer }
				});
				binding++;
			}
			bindGroupLayout = gpuDevice.createBindGroupLayout({ entries: entriesBindGroupLayout });
			bindGroup = gpuDevice.createBindGroup({
				layout: bindGroupLayout,
				entries: entriesBindGroup
			});
			const shaderCode = settings.shaderCode;
			if (shaderCode) onLoad(shaderCode);else {
				fetch(settings.shaderCodeFile).then(response => {
					if (!response.ok) {
						throw new Error(`Load "${response.url}" ${response.statusText}. Status = ${response.status}`);
					}
					return response.text();
				}).then(shaderCode => {
					onLoad(shaderCode);
				}).catch(error => {
					console.error(error);
				});
			}
			async function onLoad(shaderCode) {
				if (settings.shaderCodeText) shaderCode = settings.shaderCodeText(shaderCode);
				const shaderModule = gpuDevice.createShaderModule({ code: shaderCode });
				const computePipeline = gpuDevice.createComputePipeline({
					layout: gpuDevice.createPipelineLayout({
						bindGroupLayouts: [bindGroupLayout]
					}),
					compute: {
						module: shaderModule,
						entryPoint: "main"
					}
				});
				function createCommandEncoder() {
					const commandEncoder = gpuDevice.createCommandEncoder();
					const passEncoder = commandEncoder.beginComputePass();
					passEncoder.setPipeline(computePipeline);
					passEncoder.setBindGroup(0, bindGroup);
					let workgroupCount = [];
					if (input && input.matrices) input.matrices.forEach((item, i) => workgroupCount.push(Math.ceil(item.matrix[i] / 8)));else {
						if (settings.workgroupCount) workgroupCount = settings.workgroupCount;else workgroupCount.push(1);
					}
					const workgroupCountX = workgroupCount[0],
					      workgroupCountY = workgroupCount[1],
					      workgroupCountZ = workgroupCount[3];
					passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY, workgroupCountZ);
					passEncoder.end();
					if (settings.results) settings.results.forEach(resultMatrix => {
						resultMatrix.gpuReadBuffer = gpuDevice.createBuffer({
							size: resultMatrix.buffer.size,
							usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
						});
						commandEncoder.copyBufferToBuffer(resultMatrix.buffer,
						0,
						resultMatrix.gpuReadBuffer,
						0,
						resultMatrix.buffer.size
						);
					});
					return commandEncoder.finish();
				}
				gpuDevice.queue.submit([createCommandEncoder()]);
				if (settings.results) {
					async function waitResult(i) {
						const result = settings.results[i];
						if (!result.out) {
							console.error('WebGPU: settings.results[' + i + '].out is undefined.');
							return;
						}
						if ((result.phase || 0) !== phase.param) return;
						await result.gpuReadBuffer.mapAsync(GPUMapMode.READ);
						result.out(result.gpuReadBuffer.getMappedRange());
					}
					while (true) {
						for (let i = 0; i < settings.results.length; i++) await waitResult(i);
						phase.param++;
						if (phase.param > phase.max) break;
						gpuDevice.queue.writeBuffer(phase.paramBuffer, 0, new Uint32Array([phase.param]));
						gpuDevice.queue.submit([createCommandEncoder()]);
					}
				}
			}
		}
		initializeWebGPU();
	}
}
WebGPU.isSupportWebGPU = function () {
	return 'gpu' in navigator;
};
WebGPU.out2Matrix = function (out, settings = {}) {
	const array = settings.type ? new settings.type(out) : new Float32Array(out),
	      matrix = [];
	let valueIndex, dimension;
	const size = settings.size;
	if (size) {
		dimension = size.length;
		valueIndex = 0;
	} else {
		dimension = array[0];
		valueIndex = dimension + 1;
	}
	function iteration(level, matrixLevel) {
		if (level > dimension) return;
		const levelCount = size ? size[level - 1] : array[level];
		for (let i = 0; i < levelCount; i++) {
			const matrixNextLevel = [];
			if (level === dimension - 1) {
				const length = size ? size[dimension - 1] : array[dimension];
				for (let j = 0; j < length; j++) {
					if (valueIndex >= array.length) {
						console.error('WebGPU.out2Matrix: out of the index range of the out array. ' + valueIndex);
						return;
					}
					matrixNextLevel.push(array[valueIndex]);
					valueIndex++;
				}
				if (settings.push) settings.push(matrixNextLevel);
			} else {
				const nextlLevel = level + 1;
				iteration(nextlLevel, matrixNextLevel);
			}
			if (!settings.push || settings.returnMatrix) matrixLevel.push(matrixNextLevel);
		}
	}
	iteration(1, matrix);
	return matrix;
};
WebGPU.gui = class {
	constructor(options, dat) {
		if (!options.boOptions) {
			console.error('WebGPU.gui: call options = new Options( options ) first');
			return;
		}
		const gui = options.dat.gui;
		if (!gui) return;
		const getLanguageCode = options.getLanguageCode;
		const lang = {
			webGPU: 'WebGPU',
			webGPUTitle: 'WebGPU settings'
		};
		const _languageCode = getLanguageCode();
		switch (_languageCode) {
			case 'ru':
				lang.webGPUTitle = 'Настройки WebGPU';
				break;
			default:
				if (guiParams.lang === undefined || guiParams.lang.languageCode != _languageCode) break;
				Object.keys(guiParams.lang).forEach(function (key) {
					if (lang[key] === undefined) return;
					lang[key] = guiParams.lang[key];
				});
		}
		const fParent = gui,
		      fWebGPU = fParent.addFolder(lang.webGPU);
		dat.folderNameAndTitle(fWebGPU, lang.webGPU, lang.webGPUTitle);
		return;
		this.object = function (object, dat) {
			var display = 'none';
			if (object && object.userData.nd) {
				display = 'block';
				object.userData.nd(fND, dat);
			} else Object.keys(fND.__folders).forEach(key => {
				const folder = fND.__folders[key];
				if (!folder.userData || folder.userData.objectItems === undefined) return;
				const cSegment = folder.__controllers[0],
				      selectedItem = 0;
				cSegment.__select.selectedIndex = selectedItem;
				cSegment.setValue(cSegment.__select[selectedItem].innerHTML);
			});
			fND.domElement.style.display = display;
		};
	}
};

exports['default'] = WebGPU;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=WebGPU.js.map
