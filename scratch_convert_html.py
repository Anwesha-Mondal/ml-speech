import re

with open(r'C:\Users\krris\.gemini\antigravity-ide\brain\fddb50ea-5e09-49ff-9df6-7c444f83e9c5\.system_generated\steps\490\content.md', encoding='utf-8') as f:
    html = f.read()

main_match = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
main_html = main_match.group(1) if main_match else ''

jsx = main_html.replace('class=', 'className=')
jsx = jsx.replace('<!--', '{/*').replace('-->', '*/}')
jsx = jsx.replace('style="width: 84%;"', 'style={{width: "84%"}}')
jsx = jsx.replace('style="width: 76%;"', 'style={{width: "76%"}}')
jsx = jsx.replace('style="width: 85%;"', 'style={{width: "85%"}}')
jsx = jsx.replace('style="width: 83.3%;"', 'style={{width: "83.3%"}}')

# self-close tags
jsx = re.sub(r'<img(.*?)(?<!/)>', r'<img\1 />', jsx)
jsx = re.sub(r'<input(.*?)(?<!/)>', r'<input\1 />', jsx)

with open(r'frontend\src\pages\SandboxHTML.tsx', 'w', encoding='utf-8') as f:
    f.write(jsx)
