# [WebGPU](https://gpuweb.github.io/gpuweb/).

GPU Compute on the web. Thanks to [Get started with GPU Compute on the web](https://web.dev/gpu-compute/).

# Content
* [Quick start.](#Quickstart)
* [Example of your web page.](#WebPage)
* [Directory Contents.](#DirectoryContents)
* [Building your own ND.](#Building)

<a name="QuickStart"></a>
## Quick start

* Create a folder on your localhost named as [folderName].
* Add your web page into [folderName]. Example:
```
<!DOCTYPE html>

<html>
<head>
    <title>webGPU compute</title>

    <!--for mobile devices-->
    <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">

    <meta name="author" content="Andrej Hristoliubov https://github.com/anhr">

</head>
<body>
    <script nomodule>alert('Fatal error: Your browser do not support modular JavaScript code.');</script>
    <div id="info">
        <h1><a href="https://gpuweb.github.io/gpuweb/" target="_blank" rel="noopener">WebGPU</a> compute.</h1>
        By <a href="https://github.com/anhr" target="_blank" rel="noopener">anhr</a>.
        <a href="https://github.com/anhr/WebGPU" target="_blank" rel="noopener">github</a>.
    </div>
    Instructions: Check out DevTools JavaScript console.
    <script type="module">


    </script>
</body>
</html>
```
The easiest way to use <b>WebGPU</b> in your code is import <b>WebGPU</b> from <b>WebGPU.js</b> file in your JavaScript module.
```
import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/WebGPU.js';
//import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/build/WebGPU.module.min.js';
//import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/build/WebGPU.module.js';
```

Or download [WebGPU](https://github.com/anhr/WebGPU) repository into your "[folderName]\WebGPU\master" folder.
```
import WebGPU from './WebGPU/master/WebGPU.js';
//import WebGPU from './WebGPU/master/build/WebGPU.module.js';
//import WebGPU from './WebGPU/master/build/WebGPU.module.min.js';
```

Now you can use <b>WebGPU</b> in your javascript code.

To illustrate the use of compute shaders in WebGPU, we'll play with matrix multiplication, a common algorithm in machine learning illustrated below.

* Create two matrix for multiplication.
```
const firstMatrix = [
		[1, 2, 3, 4],
		[5, 6, 7, 8]
	],
		secondMatrix = [
		[1, 2],
		[3, 4],
		[5, 6],
		[7, 8],
	];
```
* Compute shader code.

The compute shader code for multiplying matrices is written in <a href="https://gpuweb.github.io/gpuweb/wgsl/" target="_blank" rel="noopener">WGSL</a>,
the WebGPU Shader Language, that is trivially translatable to <a href="https://www.khronos.org/spir/" target="_blank" rel="noopener">SPIR-V</a>.
Without going into detail, you should find below the three storage buffers identified with var<storage>.
The program will use <b>firstMatrix</b> and <b>secondMatrix</b> as inputs and <b>resultMatrix</b> as its output.
```
const shaderCode = `
struct Matrix {
	size: vec2<f32>,
	numbers : array<f32>,
}
@group(0) @binding(0) var<storage, read> firstMatrix : Matrix;
@group(0) @binding(1) var<storage, read> secondMatrix : Matrix;

const dimension = 2;//Dimension of resultMatrix
struct ResultMatrix {
dimension: f32,
size : array<f32, dimension>,//5.2.9. Array Types https://gpuweb.github.io/gpuweb/wgsl/#fixed-size-array
numbers : array<f32>,
}
@group(0) @binding(2) var<storage, read_write> resultMatrix : ResultMatrix;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
	// Guard against out-of-bounds work group sizes
	if (global_id.x >= u32(firstMatrix.size.x) || global_id.y >= u32(secondMatrix.size.y)) {
		return;
	}

	resultMatrix.dimension = f32(dimension);
	resultMatrix.size[0] = firstMatrix.size.x;
	resultMatrix.size[1] = secondMatrix.size.y;

	let resultCell = vec2(global_id.x, global_id.y);
	var result = 0.0;
	for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
		let a = i + resultCell.x * u32(firstMatrix.size.y);
		let b = resultCell.y + i * u32(secondMatrix.size.y);
		result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
	}

	let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
	resultMatrix.numbers[index] = result;
}
`;
```
* GPU Compute
```
new WebGPU({

	input: { matrices: [firstMatrix, secondMatrix] },

	shaderCode: shaderCode,
	//shaderCodeFile: 'Shader.c',

	results: [

		{

			count: firstMatrix.length * secondMatrix[0].length +

				//result matrix has reserved three elements in the head of the matrix for size of the matrix.
				//First element is dimension of result matrix.
				//Second element is rows count of the matrix.
				//Third element is columns count of the matrix.
				//See settings.size of out2Matrix method in https://raw.githack.com/anhr/WebGPU/master/jsdoc/module-WebGPU-WebGPU.html
				3,
			out: out => {

				console.log(new Float32Array(out));
				const matrix = WebGPU.out2Matrix(out);
				console.log(matrix);

			}

		},
	],

});
```

* NOTE: You can write the shader code in separate file. For example, create following a <b>Shader.c</b> file in the [folderName] folder:
```
struct Matrix {
size: vec2<f32>,
numbers : array<f32>,
}
@group(0) @binding(0) var<storage, read> firstMatrix : Matrix;
@group(0) @binding(1) var<storage, read> secondMatrix : Matrix;

const dimension = 2;//Dimension of resultMatrix
struct ResultMatrix {
dimension: f32,
size : array<f32, dimension>,//5.2.9. Array Types https://gpuweb.github.io/gpuweb/wgsl/#fixed-size-array
numbers : array<f32>,
}
@group(0) @binding(2) var<storage, read_write> resultMatrix : ResultMatrix;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
	// Guard against out-of-bounds work group sizes
	if (global_id.x >= u32(firstMatrix.size.x) || global_id.y >= u32(secondMatrix.size.y)) {
		return;
	}

	resultMatrix.dimension = f32(dimension);
	resultMatrix.size[0] = firstMatrix.size.x;
	resultMatrix.size[1] = secondMatrix.size.y;

	let resultCell = vec2(global_id.x, global_id.y);
	var result = 0.0;
	for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
		let a = i + resultCell.x * u32(firstMatrix.size.y);
		let b = resultCell.y + i * u32(secondMatrix.size.y);
		result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
	}

	let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
	resultMatrix.numbers[index] = result;
}
```
comment the <b>shaderCode</b> key and uncomment the <b>shaderCodeFile</b> key in <b>new WebGPU</b>.

* NOTE: You can use the [WebGPU.out2Matrix(out)](https://raw.githack.com/anhr/WebGPU/master/jsdoc/module-WebGPU-WebGPU.html#.out2Matrix) method to get more readable result matrix. See above.

Now you can see following text in DevTools JavaScript console:

```
out:
Float32Array(7) [2, 2, 2, 50, 60, 114, 140, buffer: ArrayBuffer(28), byteLength: 28, byteOffset: 0, length: 7, Symbol(Symbol.toStringTag): 'Float32Array']
matrix:
(2) [Array(2), Array(2)]0: (2) [50, 60]1: (2) [114, 140]length: 2
```

<a name="WebPage"></a>
## Example of your web page.
The following code is the result of this tutorial.
```
<!DOCTYPE html>

<html>
<head>
    <title>webGPU compute</title>

    <!--for mobile devices-->
    <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">

    <meta name="author" content="Andrej Hristoliubov https://github.com/anhr">

</head>
<body>
    <script nomodule>alert('Fatal error: Your browser do not support modular JavaScript code.');</script>
    <div id="info">
        <h1><a href="https://gpuweb.github.io/gpuweb/" target="_blank" rel="noopener">WebGPU</a> compute.</h1>
        By <a href="https://github.com/anhr" target="_blank" rel="noopener">anhr</a>.
        <a href="https://github.com/anhr/WebGPU" target="_blank" rel="noopener">github</a>.
    </div>
    Instructions: Check out DevTools JavaScript console.
    <script type="module">

        import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/WebGPU.js';
        //import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/build/WebGPU.module.min.js';
        //import WebGPU from 'https://raw.githack.com/anhr/WebGPU/master/build/WebGPU.module.js';
        //import WebGPU from './WebGPU/master/WebGPU.js';
        //import WebGPU from './WebGPU/master/build/WebGPU.module.js';
        //import WebGPU from './WebGPU/master/build/WebGPU.module.min.js';
        
        const firstMatrix = [
                [1, 2, 3, 4],
                [5, 6, 7, 8]
            ],
            secondMatrix = [
                [1, 2],
                [3, 4],
                [5, 6],
                [7, 8],
            ];

        const shaderCode = `
struct Matrix {
	size: vec2<f32>,
	numbers : array<f32>,
}
@group(0) @binding(0) var<storage, read> firstMatrix : Matrix;
@group(0) @binding(1) var<storage, read> secondMatrix : Matrix;

const dimension = 2;//Dimension of resultMatrix
struct ResultMatrix {
dimension: f32,
size : array<f32, dimension>,//5.2.9. Array Types https://gpuweb.github.io/gpuweb/wgsl/#fixed-size-array
numbers : array<f32>,
}
@group(0) @binding(2) var<storage, read_write> resultMatrix : ResultMatrix;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
	// Guard against out-of-bounds work group sizes
	if (global_id.x >= u32(firstMatrix.size.x) || global_id.y >= u32(secondMatrix.size.y)) {
		return;
	}

	resultMatrix.dimension = f32(dimension);
	resultMatrix.size[0] = firstMatrix.size.x;
	resultMatrix.size[1] = secondMatrix.size.y;

	let resultCell = vec2(global_id.x, global_id.y);
	var result = 0.0;
	for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
		let a = i + resultCell.x * u32(firstMatrix.size.y);
		let b = resultCell.y + i * u32(secondMatrix.size.y);
		result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
	}

	let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
	resultMatrix.numbers[index] = result;
}
`;

        new WebGPU({

            input: { matrices: [firstMatrix, secondMatrix] },

            //shaderCode: shaderCode,
            shaderCodeFile: 'Shader.c',

            results: [

                {

                    count: firstMatrix.length * secondMatrix[0].length +

                        //result matrix has reserved three elements in the head of the matrix for size of the matrix.
                        //First element is dimension of result matrix.
                        //Second element is rows count of the matrix.
                        //Third element is columns count of the matrix.
                        //See settings.size of out2Matrix method in https://raw.githack.com/anhr/WebGPU/master/jsdoc/module-WebGPU-WebGPU.html
                        3,
                    out: out => {

                        console.log('out:');
                        console.log(new Float32Array(out));
                        const matrix = WebGPU.out2Matrix(out);
                        console.log('matrix:');
                        console.log(matrix);

                    }

                },
            ],

        });

    </script>
</body>
</html>
```
<a name="DirectoryContents"></a>
## Directory Contents

```
build - Compiled source code.
```

<a name="Building"></a>
## Building your own WebGPU.

In the terminal, enter the following:

```
$ npm install
$ npm install uglify-es
$ npm run build
```
