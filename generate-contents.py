import re

f = open('contents.txt')

lines = f.readlines()

# print(lines)

basewsp = 3

print("%sh2 Contents" % (" "*(4*basewsp)))
print("%sul.contents-accordion(style=\"list-style-type:none\")" % (" "*(4*basewsp)))
whitespace = 0
previous_wspace = 0
tabbed = False

deepest_level = []
previous_wspace = 0
start = -1
stop = -1
for i in range(1, len(lines)):
    match1 = re.match('(\t+)[^\t]+', lines[i-1])
    match2 = re.match('(\t+)[^\t]+', lines[i])
    if match1:
        whitespace1 = len(match1.groups()[0])
    else:
        whitespace1 = 0
    if match2:
        whitespace2 = len(match2.groups()[0])
    else:
        whitespace2 = 0
    if whitespace2 == whitespace1:
        deepest_level.append(i-1)
    if whitespace1 > whitespace2:
        deepest_level.append(i-1) # for the last word in the category
    # print(lines[i-1], whitespace1, whitespace2)

for i in range(0, len(lines)):
    match = re.match('(\t+)[^\t]+', lines[i])
    whitespace = 0
    if match:
        whitespace = len(match.groups()[0])
    if whitespace == previous_wspace + 1:
        print("%sul.inner(style=\"list-style-type:none\")" % (" "*(2*whitespace+basewsp)*4))
    if i in deepest_level:
        print("%sli" % (" "*(2*whitespace+1+basewsp)*4))
    else:
        print("%sli.expandable" % (" "*(2*whitespace+1+basewsp)*4 ))

    if i in deepest_level:
        eng, kon = lines[i].strip().split(";")
        eng = eng.strip()
        kon = kon.strip()
        print("%sa.contents-toggle(href=\"/category/%s\", data-toggle=\"tooltip\", data-placement=\"right\", title=\"%s\") %s" % (" "*(2*whitespace+2+basewsp)*4, eng.replace("/", "%2F"), kon, eng))
    else:
        eng, kon = lines[i].strip().split(";")
        eng = eng.strip()
        kon = kon.strip()
        print("%sa.contents-toggle(href=\"javascript:void(0);\", data-toggle=\"tooltip\", data-placement=\"right\", title=\"%s\") %s" % (" "*(2*whitespace+2+basewsp)*4, kon, eng))
    previous_wspace = whitespace

print("%sh2 Contents" % (" "*(4*basewsp)))
print("%sul.contents-accordion(style=\"list-style-type:none\")" % (" "*(4*basewsp)))
for i in range(0, len(lines)):
    match = re.match('(\t+)[^\t]+', lines[i])
    whitespace = 0
    if match:
        whitespace = len(match.groups()[0])
    if whitespace == previous_wspace + 1:
        print("%sul.inner(style=\"list-style-type:none\")" % (" "*(2*whitespace+basewsp)*4))
    if i in deepest_level:
        print("%sli" % (" "*(2*whitespace+1+basewsp)*4))
    else:
        print("%sli.expandable" % (" "*(2*whitespace+1+basewsp)*4 ))

    if i in deepest_level:
        eng, kon = lines[i].strip().split(";")
        eng = eng.strip()
        kon = kon.strip()
        print("%sa.contents-toggle(href=\"/category/%s\", data-toggle=\"tooltip\", data-placement=\"right\", title=\"%s\") %s" % (" "*(2*whitespace+2+basewsp)*4, eng.replace("/", "%2F"), eng, kon))
    else:
        eng, kon = lines[i].strip().split(";")
        eng = eng.strip()
        kon = kon.strip()
        print("%sa.contents-toggle(href=\"javascript:void(0);\", data-toggle=\"tooltip\", data-placement=\"right\", title=\"%s\") %s" % (" "*(2*whitespace+2+basewsp)*4, eng, kon))
    previous_wspace = whitespace