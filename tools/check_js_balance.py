import sys
p='js/formLogic.js'
s=open(p,encoding='utf-8').read()
counts={'{':s.count('{'),'}':s.count('}'),'(':s.count('('),')':s.count(')'),'[':s.count('['),']':s.count(']')}
print('counts:',counts)
# show last 200 chars
print('\nlast 400 chars:\n',s[-400:])
