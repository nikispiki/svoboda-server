import re
from itertools import chain


file = list(open("plocha4.obj"))

temp_vertices = []
temp_normals = []
temp_uvs = []

out_vertices = []
out_normals = []
out_uvs = []
indeces = []

def process_vertex(vertexData):
	current_vertex_pointer = int(vertexData[0]) - 1
	indeces.append(current_vertex_pointer)
	if vertexData[1]:
		current_texture = temp_uvs[int(vertexData[1]) - 1]
		out_uvs.insert(current_vertex_pointer*2, float(current_texture[0]))
		out_uvs.insert(current_vertex_pointer*2+1, float(current_texture[1]))
	current_normal = temp_normals[int(vertexData[2]) - 1]
	out_normals.insert(current_vertex_pointer*3, current_normal[0])
	out_normals.insert(current_vertex_pointer*3+1, current_normal[1])
	out_normals.insert(current_vertex_pointer*3+2, current_normal[2])

for line in file:
	line_striped = line.rstrip()
	line_split = line_striped.split()
	if line_split:
		line_header = line_split[0]
		if (line_header == "v"):
			vertex = line_split[1:]
			temp_vertices.append(vertex)
		elif line_header == "vt":
			uv = line_split[1:]
			temp_uvs.append(uv)
		elif line_header == "vn":
			normal = line_split[1:]
			temp_normals.append(normal)
		elif line_header == "f":
			vertexIndex3 = []
			uvIndex3 = []
			normalIndex3 = []
			for idx, val in enumerate(line_split[1:]):
				process_vertex(val.split("/"))


print(len(list(float(i) for i in list(chain.from_iterable(temp_vertices)))))
print(len(indeces))
print(len(out_uvs))
 