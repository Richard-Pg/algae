AI藻类识别系统 Demo

AI Algae Identification System (Web + App Demo)

⸻

1 项目目标

Project Objective

中文

开发一个AI驱动的网页和移动端 Demo，用于识别显微镜图像或水华爆发图片中的藻类（特别是有害蓝藻和硅藻）。用户上传图片后，系统利用图像识别模型自动预测藻类的属或种，并返回相关生态信息（是否有毒、常见环境条件等）。

English

Develop an AI-powered web and mobile demo application that identifies algae species from uploaded images, including microscope images and harmful algal bloom (HAB) photos. The system should use an image recognition model to predict the likely genus or species and provide relevant ecological information (e.g., toxin production, bloom risk, environmental conditions).

⸻

2 用户类型

Target Users

中文

目标用户包括：
	•	环境科学研究人员
	•	水质监测机构
	•	政府环保部门
	•	学生和教育用户
	•	citizen scientists

English

Target users include:
	•	Environmental researchers
	•	Water quality monitoring agencies
	•	Government environmental agencies
	•	Students and educators
	•	Citizen scientists

⸻

3 核心功能

Core Features

⸻

3.1 图片上传

Image Upload

中文

用户可以上传图片进行识别。

支持图片来源：
	1.	显微镜照片
	2.	水华爆发图片
	3.	水体表面照片
	4.	实地采样照片

支持格式：
	•	JPG
	•	PNG
	•	HEIC
	•	TIFF（科研用户）

上传方式：
	•	拍照
	•	从手机相册上传
	•	Web拖拽上传

⸻

English

Users can upload images for algae identification.

Supported image sources:
	1.	Microscope images
	2.	Harmful algal bloom photos
	3.	Surface water images
	4.	Field sampling photos

Supported formats:
	•	JPG
	•	PNG
	•	HEIC
	•	TIFF (for research users)

Upload methods:
	•	Take photo
	•	Upload from gallery
	•	Drag-and-drop upload (web)

⸻

3.2 AI识别结果

AI Identification Results

系统返回：

The system should return:

⸻

1. 预测物种

Predicted Species
示例 Example
code
白 Copy
Possible Identification
Microcystis aeruginosaConfidence:87%
Other possible species:Dolichospermum spp.(9%)Aphanizomenon spp.(4%)

其他的说明如本文件夹中的图片instruction 1 to 11所示。
